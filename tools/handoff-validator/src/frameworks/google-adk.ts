/**
 * Google ADK (Agent Development Kit) framework config parser
 *
 * Parses Google ADK agent configurations into normalized AgentConfig.
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

export class GoogleADKParser implements FrameworkParser {
  framework = "google-adk";
  displayName = "Google ADK";

  detect(config: unknown): boolean {
    if (!isObject(config)) return false;
    // Google ADK configs have instruction (singular) + tools, or sub_agents
    // Note: OpenAI Assistant uses "instructions" (plural), so we check for "instruction" specifically
    return (
      ("instruction" in config && typeof config.instruction === "string") ||
      ("sub_agents" in config && Array.isArray(config.sub_agents))
    );
  }

  parse(config: unknown): AgentConfig {
    if (!isObject(config)) {
      throw new Error("Invalid Google ADK config: not an object");
    }

    const name = (getProp(config, "name") as string) || "Google ADK Agent";
    const description =
      (getProp(config, "description") as string) || "Agent running on Google ADK";
    const instruction = (getProp(config, "instruction") as string) || "";
    const model = (getProp(config, "model") as string) || "gemini-2.0-flash";

    // Extract tools as capabilities
    const tools = getProp(config, "tools");
    const capabilities: AgentConfig["capabilities"] = [];

    if (Array.isArray(tools)) {
      for (const tool of tools) {
        if (typeof tool === "string") {
          capabilities.push(
            capability(
              tool,
              `Google ADK tool: ${tool}`,
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

    // Extract sub_agents as capabilities
    const subAgents = getProp(config, "sub_agents");
    if (Array.isArray(subAgents)) {
      for (const subAgent of subAgents) {
        if (typeof subAgent === "string") {
          capabilities.push(
            capability(
              `delegate_to_${subAgent}`,
              `Delegate to ${subAgent}`,
              objectSchema({ task: stringSchema("Task to delegate") }),
              objectSchema({ result: stringSchema("Delegation result") })
            )
          );
        } else if (isObject(subAgent)) {
          const subName = (subAgent.name as string) || "unknown";
          capabilities.push(
            capability(
              `delegate_to_${subName}`,
              `Delegate to ${subName}`,
              objectSchema({ task: stringSchema("Task to delegate") }),
              objectSchema({ result: stringSchema("Delegation result") })
            )
          );
        }
      }
    }

    // Default capabilities
    if (capabilities.length === 0) {
      capabilities.push(
        capability(
          "google_search",
          "Search using Google Search",
          objectSchema({ query: stringSchema("Search query") }, ["query"]),
          objectSchema({ results: arraySchema(objectSchema({ title: stringSchema(), url: stringSchema(), snippet: stringSchema() })) })
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
      response: stringSchema("Agent response"),
      functionCalls: arraySchema(
        objectSchema({
          name: stringSchema("Function name"),
          args: objectSchema(),
        })
      ),
    };

    const consumes: Record<string, JSONSchema> = {
      input: stringSchema("User input"),
      context: stringSchema("Additional context"),
    };

    return agentConfig({
      name,
      framework: this.framework,
      description,
      capabilities,
      stateSchema: stateSchema(produces, consumes),
      trustScore: 0.75,
      metadata: {
        model,
        instruction: instruction.substring(0, 200),
        subAgentCount: Array.isArray(subAgents) ? subAgents.length : 0,
      },
    });
  }
}
