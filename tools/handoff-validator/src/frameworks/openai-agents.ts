/**
 * OpenAI Agents SDK framework config parser
 *
 * Parses OpenAI Agents SDK configurations into normalized AgentConfig.
 */

import type { AgentConfig, FrameworkParser, JSONSchema } from "../types.js";
import {
  agentConfig,
  arraySchema,
  capability,
  getProp,
  isObject,
  objectSchema,
  stateSchema,
  stringSchema,
} from "./types.js";

export class OpenAIAgentsParser implements FrameworkParser {
  framework = "openai-agents";
  displayName = "OpenAI Agents SDK";

  detect(config: unknown): boolean {
    if (!isObject(config)) return false;
    // OpenAI Agents SDK configs have handoffs, guardrails, or agent definitions
    return (
      ("handoffs" in config && Array.isArray(config.handoffs)) ||
      ("guardrails" in config && Array.isArray(config.guardrails)) ||
      ("output_type" in config) ||
      ("tool_use_behavior" in config)
    );
  }

  parse(config: unknown): AgentConfig {
    if (!isObject(config)) {
      throw new Error("Invalid OpenAI Agents config: not an object");
    }

    const name = (getProp(config, "name") as string) || "OpenAI Agent";
    const description =
      (getProp(config, "description") as string) || "Agent running on OpenAI Agents SDK";
    const instructions = (getProp(config, "instructions") as string) || "";
    const model = (getProp(config, "model") as string) || "gpt-4o";

    // Extract tools as capabilities
    const tools = getProp(config, "tools");
    const capabilities: AgentConfig["capabilities"] = [];

    if (Array.isArray(tools)) {
      for (const tool of tools) {
        if (typeof tool === "string") {
          capabilities.push(
            capability(
              tool,
              `OpenAI Agents tool: ${tool}`,
              objectSchema({ input: stringSchema() }),
              objectSchema({ output: stringSchema() })
            )
          );
        } else if (isObject(tool)) {
          const toolName = (tool.name as string) || "unknown";
          const toolDesc = (tool.description as string) || `Tool: ${toolName}`;
          capabilities.push(
            capability(
              toolName,
              toolDesc,
              isObject(tool.parameters) ? (tool.parameters as JSONSchema) : objectSchema({ input: stringSchema() }),
              objectSchema({ output: stringSchema() })
            )
          );
        }
      }
    }

    // Extract handoffs as capabilities (the agent can hand off to these)
    const handoffs = getProp(config, "handoffs");
    if (Array.isArray(handoffs)) {
      for (const handoff of handoffs) {
        if (typeof handoff === "string") {
          capabilities.push(
            capability(
              `handoff_to_${handoff}`,
              `Hand off to ${handoff}`,
              objectSchema({ task: stringSchema("Task to hand off") }),
              objectSchema({ result: stringSchema("Handoff result") })
            )
          );
        } else if (isObject(handoff)) {
          const handoffName = (handoff.agent_name as string) || (handoff.name as string) || "unknown";
          capabilities.push(
            capability(
              `handoff_to_${handoffName}`,
              `Hand off to ${handoffName}`,
              objectSchema({ task: stringSchema("Task to hand off") }),
              objectSchema({ result: stringSchema("Handoff result") })
            )
          );
        }
      }
    }

    // Default capabilities
    if (capabilities.length === 0) {
      capabilities.push(
        capability(
          "web_search",
          "Search the web",
          objectSchema({ query: stringSchema("Search query") }, ["query"]),
          objectSchema({ results: arraySchema(objectSchema({ title: stringSchema(), url: stringSchema(), snippet: stringSchema() })) })
        ),
        capability(
          "file_search",
          "Search files",
          objectSchema({ query: stringSchema("Search query") }, ["query"]),
          objectSchema({ results: arraySchema(objectSchema({ content: stringSchema() })) })
        ),
        capability(
          "code_execution",
          "Execute code",
          objectSchema({ code: stringSchema("Code to execute") }, ["code"]),
          objectSchema({ output: stringSchema(), stdout: stringSchema() })
        )
      );
    }

    // State schema
    const produces: Record<string, JSONSchema> = {
      messages: arraySchema(
        objectSchema({
          role: stringSchema("Message role"),
          content: stringSchema("Message content"),
        })
      ),
      output: stringSchema("Agent output"),
      handoff: objectSchema({
        agentName: stringSchema("Handoff agent name"),
        reason: stringSchema("Handoff reason"),
      }),
    };

    const consumes: Record<string, JSONSchema> = {
      input: stringSchema("User input"),
      context: objectSchema({
        conversationHistory: arraySchema(objectSchema({ role: stringSchema(), content: stringSchema() })),
      }),
    };

    return agentConfig({
      name,
      framework: this.framework,
      description,
      capabilities,
      stateSchema: stateSchema(produces, consumes),
      trustScore: 0.8,
      metadata: {
        model,
        instructions: instructions.substring(0, 200),
        handoffs: Array.isArray(handoffs) ? handoffs.length : 0,
      },
    });
  }
}
