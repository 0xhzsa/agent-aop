/**
 * Framework parser registry
 */

import type { FrameworkParser } from "../types.js";
import { ClaudeCodeParser } from "./claude-code.js";
import { OpenAIAssistantParser } from "./openai-assistant.js";
import { OpenAIAgentsParser } from "./openai-agents.js";
import { AutoGenParser } from "./autogen.js";
import { LangGraphParser } from "./langgraph.js";
import { CrewAIParser } from "./crewai.js";
import { GoogleADKParser } from "./google-adk.js";
import { CustomParser } from "./custom.js";

/** All available framework parsers */
const parsers: FrameworkParser[] = [
  new ClaudeCodeParser(),
  new OpenAIAgentsParser(), // Before OpenAI Assistant — more specific (has handoffs)
  new OpenAIAssistantParser(),
  new AutoGenParser(),
  new LangGraphParser(),
  new CrewAIParser(),
  new GoogleADKParser(),
  new CustomParser(), // Must be last — it's the fallback
];

/**
 * Detect the framework of a config and return the appropriate parser
 */
export function detectFramework(config: unknown): FrameworkParser {
  for (const parser of parsers) {
    if (parser.detect(config)) {
      return parser;
    }
  }
  // Should never reach here since CustomParser accepts anything
  return parsers[parsers.length - 1]!;
}

/**
 * Parse a config into a normalized AgentConfig
 */
export function parseConfig(config: unknown): { parser: FrameworkParser; agentConfig: import("../types.js").AgentConfig } {
  const parser = detectFramework(config);
  const agentConfig = parser.parse(config);
  return { parser, agentConfig };
}

/**
 * Get all registered framework parsers
 */
export function getParsers(): FrameworkParser[] {
  return [...parsers];
}

export { ClaudeCodeParser } from "./claude-code.js";
export { OpenAIAssistantParser } from "./openai-assistant.js";
export { OpenAIAgentsParser } from "./openai-agents.js";
export { AutoGenParser } from "./autogen.js";
export { LangGraphParser } from "./langgraph.js";
export { CrewAIParser } from "./crewai.js";
export { GoogleADKParser } from "./google-adk.js";
export { CustomParser } from "./custom.js";
