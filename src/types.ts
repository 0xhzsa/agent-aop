// Core type definitions for AOP

/** Protocol version string */
export const AOP_VERSION = "aop/0.1";

/** State schema version */
export const STATE_SCHEMA_VERSION = "aop-state/0.1";

/** Unique identifier type (UUIDv7-style) */
export type AgentId = string;
export type MessageId = string;
export type TaskId = string;

/** Supported frameworks */
export type Framework =
  | "claude-code"
  | "openai-assistant"
  | "openai-agents"
  | "autogen"
  | "langgraph"
  | "crewai"
  | "google-adk"
  | "open-source"
  | "custom";

/** Message types in the AOP registry */
export type MessageType =
  | "capability.discover"
  | "capability.declare"
  | "task.initiate"
  | "task.handoff"
  | "task.status"
  | "task.result"
  | "task.error"
  | "state.snapshot"
  | "trust.attest";

/** Agent identity with cryptographic key reference */
export interface AgentIdentity {
  id: AgentId;
  publicKey: string; // Ed25519 public key (hex)
  framework: Framework;
  protocolVersion: string;
  name: string;
  description: string;
  trustScore: number; // 0-1
  lastActive: string; // ISO 8601
}

/** Capability declaration */
export interface Capability {
  name: string;
  description: string;
  schema: Record<string, unknown>; // JSON Schema
  examples?: unknown[];
}

/** Full capability registry for an agent */
export interface CapabilityRegistry {
  agentId: AgentId;
  capabilities: Capability[];
  declaredAt: string; // ISO 8601
  signature: string; // Ed25519 signature of the above
}

/** Agent endpoint connection info */
export interface AgentEndpoint {
  transport: "http" | "websocket" | "p2p";
  url?: string;
  peerId?: string;
}

/** Sender/recipient info in an envelope */
export interface EnvelopeParticipant {
  id: AgentId;
  framework: Framework;
  protocolVersion: string;
  endpoint?: AgentEndpoint;
}

/** Priority for task handoffs (1-10) */
export type TaskPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Message envelope — the universal AOP message format */
export interface Envelope<T extends MessageType = MessageType> {
  version: typeof AOP_VERSION;
  messageId: MessageId;
  timestamp: string;
  sender: EnvelopeParticipant;
  recipient: EnvelopeParticipant | null; // null = broadcast
  type: T;
  payload: Record<string, unknown>;
  state?: StateSnapshot;
  capabilities?: CapabilityRegistry;
  signature: string; // Ed25519 signature of canonical JSON
}

/** State snapshot for handoff */
export interface StateSnapshot {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  variables: Record<string, unknown>;
  files: StateFile[];
  context: StateContext;
}

export interface StateFile {
  path: string;
  content: string; // base64-encoded
  mimeType: string;
}

export interface StateContext {
  conversationHistory: unknown[];
  decisionsMade: string[];
  constraints: string[];
}

/** Task initiation */
export interface TaskInitiatePayload {
  taskId: TaskId;
  intent: string;
  requirements: Record<string, unknown>;
  constraints: {
    deadline?: string;
    budget?: { tokens?: number; costUsd?: number };
  };
}

/** Task handoff */
export interface TaskHandoffPayload {
  taskId: TaskId;
  reason: string;
  priority: TaskPriority;
  nextSteps: string[];
  preferredRecipient?: AgentId;
}

/** Task result */
export interface TaskResultPayload {
  taskId: TaskId;
  success: boolean;
  output: unknown;
  artifacts: { path: string; url?: string }[];
  durationMs: number;
}

/** Task error */
export interface TaskErrorPayload {
  taskId: TaskId;
  error: {
    type: string;
    message: string;
    stack?: string;
  };
}

/** Task status */
export interface TaskStatusPayload {
  taskId: TaskId;
  status: "pending" | "running" | "completed" | "failed" | "handoff";
  progress?: number;
  currentStep?: string;
}

/** Capability discovery */
export interface CapabilityDiscoverPayload {
  requestedCapabilities: string[];
  query?: string; // natural language query for best-fit capability
}

/** Capability declaration */
export interface CapabilityDeclarePayload {
  registries: CapabilityRegistry[];
}

/** Trust attestation */
export interface TrustAttestPayload {
  agentId: AgentId;
  trustScore: number;
  evidence: string[];
  attestedBy: AgentId;
}
