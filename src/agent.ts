// Core Agent class implementing AOP

import {
  Envelope,
  EnvelopeParticipant,
  AgentIdentity,
  Capability,
  CapabilityRegistry,
  StateSnapshot,
  TaskId,
  MessageType,
} from "./types.js";

import {
  createEnvelope,
  verifyEnvelopeStructure,
  createParticipant,
  generateTaskId,
} from "./envelope.js";

import { createStateSnapshot } from "./state.js";
import { createCapabilityRegistry } from "./capabilities.js";
import { signEnvelope, verifyEnvelope, TrustAnchor, updateTrustScore, signCapabilityRegistry } from "./trust.js";

/**
 * A task that an agent is working on
 */
interface ActiveTask {
  taskId: TaskId;
  intent: string;
  state: StateSnapshot;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent event handlers
 */
type EventHandler = (envelope: Envelope) => Promise<void> | void;

/**
 * Core AOP Agent — implements the Agent Orchestration Protocol
 *
 * This is the reference implementation. Framework-specific agents
 * extend this class to add their custom logic while conforming to AOP.
 */
export class AopAgent {
  readonly identity: AgentIdentity;
  readonly privateKey: string;
  private trustAnchor: TrustAnchor;
  private capabilities: Capability[] = [];
  private activeTasks: Map<TaskId, ActiveTask> = new Map();
  private eventHandlers: Map<MessageType, EventHandler[]> = new Map();

  constructor(params: {
    id: string;
    name: string;
    description: string;
    framework: AgentIdentity["framework"];
    privateKey: string; // Ed25519 private key PEM
    publicKey: string;  // Ed25519 public key PEM
    capabilities: Capability[];
    trustAnchor?: TrustAnchor;
  }) {
    this.identity = {
      id: params.id,
      publicKey: params.publicKey,
      framework: params.framework,
      protocolVersion: "1.0",
      name: params.name,
      description: params.description,
      trustScore: 0.5, // Start at neutral
      lastActive: new Date().toISOString(),
    };
    this.privateKey = params.privateKey;
    this.trustAnchor = params.trustAnchor || new TrustAnchor();
    this.capabilities = params.capabilities;

    // Register self with trust anchor
    this.trustAnchor.registerAgent(this.identity.id, this.identity.publicKey);
  }

  /** Get the agent's participant identity */
  getParticipant(): EnvelopeParticipant {
    return createParticipant(
      this.identity.id,
      this.identity.framework
    );
  }

  /** Get the agent's capability registry (signed) */
  getCapabilityRegistry(): CapabilityRegistry {
    const registry = createCapabilityRegistry(
      this.identity.id,
      this.capabilities,
      "" // placeholder, will be signed
    );

    // Sign the registry
    const registryNoSig: Omit<CapabilityRegistry, "signature"> = {
      agentId: registry.agentId,
      capabilities: registry.capabilities,
      declaredAt: registry.declaredAt,
    };
    const signedSignature = signCapabilityRegistry(
      registryNoSig,
      this.privateKey
    );

    return {
      ...registry,
      signature: signedSignature,
    };
  }

  /** Send a message to another agent */
  async sendMessage<T extends MessageType>(
    recipient: EnvelopeParticipant | null,
    type: T,
    payload: Record<string, unknown>,
    options?: {
      state?: StateSnapshot;
      capabilities?: CapabilityRegistry;
    }
  ): Promise<Envelope> {
    const envelope = createEnvelope(
      this.getParticipant(),
      recipient,
      type,
      payload,
      options
    );

    // Sign the envelope
    const signature = signEnvelope(envelope, this.privateKey);

    return { ...envelope, signature } as Envelope;
  }

  /** Receive and process an incoming envelope */
  async receiveMessage(envelope: Envelope): Promise<boolean> {
    // Verify structure
    const verified = verifyEnvelopeStructure(envelope);
    if (!verified) {
      console.error("Invalid envelope structure");
      return false;
    }

    // Verify signature
    if (this.trustAnchor.isRegistered(envelope.sender.id)) {
      const publicKey = this.trustAnchor.getPublicKey(envelope.sender.id)!;
      if (!verifyEnvelope(envelope, publicKey)) {
        console.error("Invalid signature on envelope");
        return false;
      }
    }

    // Dispatch to handlers
    const handlers = this.eventHandlers.get(envelope.type) || [];
    for (const handler of handlers) {
      await handler(envelope);
    }

    // Update trust score based on successful processing
    if (envelope.sender.id !== this.identity.id) {
      const update = updateTrustScore(
        envelope.sender.id,
        this.identity.trustScore,
        "success"
      );
      this.identity.trustScore = update.newScore;
      this.identity.lastActive = new Date().toISOString();
    }

    return true;
  }

  /** Register an event handler */
  on(type: MessageType, handler: EventHandler): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    this.eventHandlers.get(type)!.push(handler);
  }

  /** Start a new task */
  async initiateTask(intent: string, requirements: Record<string, unknown>): Promise<TaskId> {
    const taskId = generateTaskId();

    const task: ActiveTask = {
      taskId,
      intent,
      state: createStateSnapshot({
        task: {
          id: taskId,
          intent,
          status: "pending",
          progress: 0,
        },
        requirements,
        workLog: [],
      }),
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.activeTasks.set(taskId, task);

    // Notify handlers
    const handlers = this.eventHandlers.get("task.initiate") || [];
    const envelope = await this.sendMessage(null, "task.initiate", {
      taskId,
      intent,
      requirements,
      constraints: {},
    }, { state: task.state });

    for (const handler of handlers) {
      await handler(envelope);
    }

    return taskId;
  }

  /** Hand off a task to another agent */
  async handoffTask(
    taskId: TaskId,
    recipient: EnvelopeParticipant,
    reason: string,
    priority: number = 5,
    nextSteps: string[] = []
  ): Promise<Envelope> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = "handoff";
    task.updatedAt = new Date().toISOString();

    const envelope = await this.sendMessage(
      recipient,
      "task.handoff",
      {
        taskId,
        reason,
        priority: priority as any,
        nextSteps,
      },
      { state: task.state }
    );

    // Notify handlers
    const handlers = this.eventHandlers.get("task.handoff") || [];
    for (const handler of handlers) {
      await handler(envelope);
    }

    return envelope;
  }

  /** Complete a task */
  async completeTask(taskId: TaskId, output: unknown): Promise<Envelope> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = "completed";
    task.updatedAt = new Date().toISOString();

    const envelope = await this.sendMessage(null, "task.result", {
      taskId,
      success: true,
      output,
      artifacts: [],
      durationMs: Date.now() - new Date(task.createdAt).getTime(),
    });

    this.activeTasks.delete(taskId);

    // Notify handlers
    const handlers = this.eventHandlers.get("task.result") || [];
    for (const handler of handlers) {
      await handler(envelope);
    }

    return envelope;
  }

  /** Update task state */
  updateTaskState(taskId: TaskId, updates: Record<string, unknown>): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    for (const [key, value] of Object.entries(updates)) {
      setNestedValue(task.state.variables, key, value);
    }

    task.updatedAt = new Date().toISOString();
  }

  /** Get current task state */
  getTaskState(taskId: TaskId): StateSnapshot | null {
    const task = this.activeTasks.get(taskId);
    return task ? task.state : null;
  }

  /** List active tasks */
  getActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values());
  }
}

// Helper to set nested values
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: any = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]!] = value;
}
