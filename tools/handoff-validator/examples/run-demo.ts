/**
 * Example: Run the handoff validator on sample configs
 */

import {
  validateHandoff,
  formatReport,
  parseConfig,
} from "../src/index.js";
import {
  claudeCodeConfig,
  openaiAssistantConfig,
  openaiAgentsConfig,
  autoGenConfig,
  langgraphConfig,
  crewaiConfig,
  googleADKConfig,
  customConfig,
} from "./agent-configs.js";

const configs: Record<string, unknown> = {
  "Claude Code": claudeCodeConfig,
  "OpenAI Assistant": openaiAssistantConfig,
  "OpenAI Agents": openaiAgentsConfig,
  "AutoGen": autoGenConfig,
  "LangGraph": langgraphConfig,
  "CrewAI": crewaiConfig,
  "Google ADK": googleADKConfig,
  "Custom": customConfig,
};

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  Agent Handoff Validator — Cross-Framework Demo          ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

// Parse all configs
const parsed: Record<string, import("../src/index.js").AgentConfig> = {};
for (const [name, config] of Object.entries(configs)) {
  const { agentConfig } = parseConfig(config);
  parsed[name] = agentConfig;
  console.log(`Parsed: ${name} → ${agentConfig.framework} (${agentConfig.capabilities.length} capabilities)`);
}

console.log("\n" + "═".repeat(60) + "\n");

// Test key handoffs
const handoffs: [string, string][] = [
  ["Claude Code", "OpenAI Assistant"],
  ["OpenAI Assistant", "Claude Code"],
  ["AutoGen", "LangGraph"],
  ["CrewAI", "Google ADK"],
  ["Custom", "Claude Code"],
  ["Google ADK", "CrewAI"],
];

for (const [sourceName, targetName] of handoffs) {
  const source = parsed[sourceName];
  const target = parsed[targetName];

  if (!source || !target) continue;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Handoff: ${sourceName} → ${targetName}`);
  console.log(`${"─".repeat(60)}`);

  const report = validateHandoff(source, target);
  console.log(formatReport(report));
}

console.log("\n" + "═".repeat(60));
console.log("Demo complete!");
