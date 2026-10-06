/**
 * OpenAI Assistant framework config parser
 *
 * Parses OpenAI Assistant API configurations into normalized AgentConfig.
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

export class OpenAIAssistantParser implements FrameworkParser {
  framework = "openai-assistant";
  displayName = "OpenAI Assistant";

  detect(config: unknown): boolean {
    if (!isObject(config)) return false;
    // OpenAI Assistant configs have instructions (plural) + tools, or assistant_id
    // Note: Google ADK uses "instruction" (singular), so we check for "instructions" specifically
    return (
      ("instructions" in config && typeof config.instructions === "string") ||
      ("assistant_id" in config && typeof config.assistant_id === "string")
    );
  }

  parse(config: unknown): AgentConfig {
    if (!isObject(config)) {
      throw new Error("Invalid OpenAI Assistant config: not an object");
    }

    const name = (getProp(config, "name") as string) || "OpenAI Assistant";
    const description =
      (getProp(config, "description") as string) || "Agent running on OpenAI Assistant API";
    const instructions = (getProp(config, "instructions") as string) || "";
    const model = (getProp(config, "model") as string) || "gpt-4o";

    // Extract tools as capabilities
    const tools = getProp(config, "tools");
    const capabilities: AgentConfig["capabilities"] = [];

    if (Array.isArray(tools)) {
      for (const tool of tools) {
        if (isObject(tool)) {
          const toolType = (tool.type as string) || "function";
          if (toolType === "function" && isObject(tool.function)) {
            const fn = tool.function;
            const fnName = (fn.name as string) || "unknown";
            const fnDesc = (fn.description as string) || `Function: ${fnName}`;
            const fnParams = isObject(fn.parameters)
              ? (fn.parameters as JSONSchema)
              : objectSchema({ input: stringSchema() });
            capabilities.push(
              capability(fnName, fnDesc, fnParams, objectSchema({ result: stringSchema() }))
            );
          } else {
            // Non-function tools (code_interpreter, file_search, etc.)
            const toolName = toolType;
            capabilities.push(
              capability(
                toolName,
                `OpenAI tool: ${toolName}`,
                objectSchema({ input: stringSchema() }),
                objectSchema({ output: stringSchema() })
              )
            );
          }
        }
      }
    }

    // Default capabilities
    if (capabilities.length === 0) {
      capabilities.push(
        capability(
          "code_interpreter",
          "Execute Python code",
          objectSchema({ code: stringSchema("Python code") }, ["code"]),
          objectSchema({ output: stringSchema(), stdout: stringSchema() })
        ),
        capability(
          "file_search",
          "Search through files",
          objectSchema({ query: stringSchema("Search query") }, ["query"]),
          objectSchema({ results: arraySchema(objectSchema({ content: stringSchema() })) })
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
      runId: stringSchema("Run ID"),
      status: stringSchema("Run status"),
    };

    const consumes: Record<string, JSONSchema> = {
      instructions: stringSchema("Assistant instructions"),
      messages: arraySchema(
        objectSchema({
          role: stringSchema("Message role"),
          content: stringSchema("Message content"),
        })
      ),
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
      },
    });
  }
}
