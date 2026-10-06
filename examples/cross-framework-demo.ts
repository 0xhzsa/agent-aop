/**
 * Cross-Framework Demo: OpenAI Assistant ↔ Claude Code Handoff
 *
 * This demonstrates the core AOP value proposition: an agent from
 * Framework A hands a task complete with state to an agent from
 * Framework B, with zero framework-specific coupling.
 *
 * The task: "Analyze the security implications of the AOP trust model"
 * Frame 1 (OpenAI Assistant) does initial research
 * Frame 2 (Claude Code) does code-level analysis
 */

import {
  AopAgent,
  generateKeyPair,
  TrustAnchor,
} from "../src/index.js";
import { EnvelopeParticipant } from "../src/types.js";

// Simulated OpenAI Assistant agent
class OpenAIAssistantAgent extends AopAgent {
  constructor(keyPair: { publicKey: string; privateKey: string }, trust: TrustAnchor) {
    super({
      id: "agent_openai_researcher",
      name: "OpenAI Research Assistant",
      description: "Research-focused agent using OpenAI's framework",
      framework: "openai-assistant",
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      capabilities: [
        {
          name: "web_search",
          description: "Search the web for information",
          schema: { type: "object", properties: { query: { type: "string" } } },
        },
        {
          name: "read_document",
          description: "Read and summarize a document",
          schema: { type: "object", properties: { url: { type: "string" } } },
        },
      ],
      trustAnchor: trust,
    });

    // Register a handler for incoming task initiations
    this.on("task.initiate", async (envelope) => {
      console.log("[OpenAI Assistant] Received task:", envelope.payload.intent);
    });
  }

  async doResearch(intent: string): Promise<any> {
    console.log("[OpenAI Assistant] 🔍 Researching:", intent);
    // Simulate research
    return {
      findings: [
        "AOP uses Ed25519 signatures for trust anchoring",
        "Trust scores are updated via exponential moving average",
        "Known risk: trust score manipulation via sybil attacks",
      ],
      sources: [
        "https://datatracker.ietf.org/doc/html/rfc8032",
        "AOP spec v0.1",
      ],
    };
  }
}

// Simulated Claude Code agent
class ClaudeCodeAgent extends AopAgent {
  constructor(keyPair: { publicKey: string; privateKey: string }, trust: TrustAnchor) {
    super({
      id: "agent_claude_code_analyzer",
      name: "Claude Code Security Analyzer",
      description: "Code-level security analysis agent",
      framework: "claude-code",
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      capabilities: [
        {
          name: "read_file",
          description: "Read source files from a codebase",
          schema: { type: "object", properties: { path: { type: "string" } } },
        },
        {
          name: "find_vulnerabilities",
          description: "Scan code for security vulnerabilities",
          schema: { type: "object", properties: { codebase: { type: "string" } } },
        },
      ],
      trustAnchor: trust,
    });
  }

  async doAnalysis(state: any): Promise<any> {
    console.log("[Claude Code] 🔐 Analyzing security of:", state.variables.task?.intent);
    // Simulate analysis using the state passed via handoff
    const researchFindings = state.variables.researchFindings || [];

    return {
      vulnerabilities: [
        {
          severity: "medium",
          title: "Trust score manipulation",
          description: "Trust scores could be gamed by creating multiple identities",
          mitigation: "Add proof-of-work requirement for trust score updates",
        },
      ],
      researchVerified: researchFindings.length > 0,
      recommendations: [
        "Add rate limiting on trust score updates",
        "Require third-party attestations for high-trust agents",
      ],
    };
  }
}

/**
 * Run the cross-framework handoff demo
 */
export async function runDemo(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  AOP Cross-Framework Handoff Demo                        ║");
  console.log("║  OpenAI Assistant → Claude Code                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Set up trust anchor
  const trust = new TrustAnchor();

  // Generate key pairs for both agents
  const openaiKeys = generateKeyPair();
  const claudeKeys = generateKeyPair();

  // Register both agents
  const openaiAgent = new OpenAIAssistantAgent(openaiKeys, trust);
  const claudeAgent = new ClaudeCodeAgent(claudeKeys, trust);

  trust.registerAgent(openaiAgent.identity.id, openaiAgent.identity.publicKey);
  trust.registerAgent(claudeAgent.identity.id, claudeAgent.identity.publicKey);

  console.log("✅ Agents initialized");
  console.log("   - OpenAI Research Assistant:", openaiAgent.identity.id);
  console.log("   - Claude Code Analyzer:", claudeAgent.identity.id);

  // Step 1: OpenAI agent initiates a task
  console.log("\n--- Step 1: OpenAI Agent Initiates Task ---\n");
  const taskId = await openaiAgent.initiateTask(
    "Analyze the security implications of the AOP trust model",
    {
      depth: "comprehensive",
      framework: "any",
    }
  );
  console.log("   Task ID:", taskId);

  // Step 2: OpenAI agent does research
  console.log("\n--- Step 2: OpenAI Agent Does Research ---\n");
  const research = await openaiAgent.doResearch(
    "Analyze the security implications of the AOP trust model"
  );
  console.log("   Findings:", research.findings.length);
  research.findings.forEach((f: string) => console.log("   •", f));

  // Update task state with research findings
  openaiAgent.updateTaskState(taskId, {
    researchFindings: research,
    currentPhase: "research_complete",
    progress: 30,
  });

  // Step 3: Handoff to Claude Code agent
  console.log("\n--- Step 3: OpenAI → Claude Code Handoff ---\n");
  const recipient: EnvelopeParticipant = claudeAgent.getParticipant();
  const handoffEnvelope = await openaiAgent.handoffTask(
    taskId,
    recipient,
    "Research complete — needs code-level security analysis",
    8,
    ["Verify trust model implementation", "Identify vulnerabilities", "Recommend mitigations"]
  );

  console.log("   Handoff envelope created:");
  console.log("   - Message ID:", handoffEnvelope.messageId);
  console.log("   - Type:", handoffEnvelope.type);
  console.log("   - Has state:", !!handoffEnvelope.state);
  console.log("   - State variables:", Object.keys(handoffEnvelope.state?.variables || {}));

  // Step 4: Claude Code receives the handoff
  console.log("\n--- Step 4: Claude Code Accepts Handoff ---\n");
  const accepted = await claudeAgent.receiveMessage(handoffEnvelope);
  console.log("   Handoff accepted:", accepted);

  // Step 5: Claude Code does its analysis using the passed state
  if (handoffEnvelope.state) {
    const analysis = await claudeAgent.doAnalysis(handoffEnvelope.state);
    console.log("   Vulnerabilities found:", analysis.vulnerabilities.length);
    console.log("   Research verified:", analysis.researchVerified);
    console.log("   Recommendations:", analysis.recommendations.length);

    // Step 6: Complete the task
    console.log("\n--- Step 5: Task Completed ---\n");
    await openaiAgent.completeTask(taskId, {
      research,
      analysis,
    });
    console.log("   ✅ Task complete — both frameworks collaborated");
  }

  console.log("\n✨ Demo complete — cross-framework agent handoff successful!\n");
}

// CLI entry point for the demo
// tsx runs in ESM mode, so we check for the --run flag via process.argv
const isMain = process.argv[1]?.endsWith("cross-framework-demo.ts");
if (isMain) {
  void runDemo().catch(console.error);
}
