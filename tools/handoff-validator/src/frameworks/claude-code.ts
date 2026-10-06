/**
 * Claude Code framework config parser
 *
 * Parses .claude/settings.json and Claude Code agent configurations
 * into the normalized AgentConfig format.
 */

import type { AgentConfig, FrameworkParser, JSONSchema } from "../types.js";
import {
  agentConfig,
  arraySchema,
  booleanSchema,
  capability,
  getProp,
  isObject,
  numberSchema,
  objectSchema,
  stateSchema,
  stringSchema,
} from "./types.js";

export class ClaudeCodeParser implements FrameworkParser {
  framework = "claude-code";
  displayName = "Claude Code";

  detect(config: unknown): boolean {
    if (!isObject(config)) return false;
    // Claude Code configs have permissions, or a model starting with "claude-"
    if ("permissions" in config) return true;
    const model = getProp(config, "model");
    if (typeof model === "string" && model.startsWith("claude-")) return true;
    // Check for Claude Code specific fields
    if ("maxTokens" in config || "max_tokens" in config) return true;
    return false;
  }

  parse(config: unknown): AgentConfig {
    if (!isObject(config)) {
      throw new Error("Invalid Claude Code config: not an object");
    }

    const name = (getProp(config, "name") as string) || "Claude Code Agent";
    const description =
      (getProp(config, "description") as string) || "Agent running on Claude Code";
    const model = (getProp(config, "model") as string) || "claude-sonnet-4-20250514";

    // Extract tools/capabilities
    const tools = getProp(config, "tools");
    const capabilities: AgentConfig["capabilities"] = [];

    if (Array.isArray(tools)) {
      for (const tool of tools) {
        if (typeof tool === "string") {
          capabilities.push(
            capability(
              tool,
              `Claude Code tool: ${tool}`,
              objectSchema({ input: stringSchema("Tool input") }),
              objectSchema({ output: stringSchema("Tool output") })
            )
          );
        } else if (isObject(tool)) {
          const toolName = (tool.name as string) || "unknown";
          const toolDesc = (tool.description as string) || `Tool: ${toolName}`;
          const inputSchema = isObject(tool.input_schema)
            ? (tool.input_schema as JSONSchema)
            : objectSchema({ input: stringSchema() });
          capabilities.push(
            capability(toolName, toolDesc, inputSchema, objectSchema({ output: stringSchema() }))
          );
        }
      }
    }

    // Extract permissions as capabilities
    const permissions = getProp(config, "permissions");
    if (isObject(permissions)) {
      const allow = permissions.allow;
      if (Array.isArray(allow)) {
        for (const perm of allow) {
          if (typeof perm === "string") {
            // Skip if already added as a tool
            if (!capabilities.find((c) => c.name === perm)) {
              capabilities.push(
                capability(
                  perm,
                  `Claude Code permission: ${perm}`,
                  objectSchema({ input: stringSchema() }),
                  objectSchema({ output: stringSchema() })
                )
              );
            }
          }
        }
      }
    }

    // Default capabilities if none found
    if (capabilities.length === 0) {
      capabilities.push(
        capability(
          "read_file",
          "Read files from the filesystem",
          objectSchema({ path: stringSchema("File path") }, ["path"]),
          objectSchema({ content: stringSchema("File content") })
        ),
        capability(
          "write_file",
          "Write files to the filesystem",
          objectSchema(
            { path: stringSchema("File path"), content: stringSchema("File content") },
            ["path", "content"]
          ),
          objectSchema({ success: booleanSchema() })
        ),
        capability(
          "bash",
          "Execute bash commands",
          objectSchema({ command: stringSchema("Shell command") }, ["command"]),
          objectSchema({ stdout: stringSchema(), stderr: stringSchema(), exitCode: numberSchema() })
        )
      );
    }

    // State schema — Claude Code agents typically work with file-based state
    const produces: Record<string, JSONSchema> = {
      files: arraySchema(
        objectSchema({
          path: stringSchema("File path"),
          content: stringSchema("File content"),
        })
      ),
      messages: arraySchema(
        objectSchema({
          role: stringSchema("Message role"),
          content: stringSchema("Message content"),
        })
      ),
    };

    const consumes: Record<string, JSONSchema> = {
      task: objectSchema({
        description: stringSchema("Task description"),
        context: stringSchema("Additional context"),
      }),
      files: arraySchema(
        objectSchema({
          path: stringSchema("File path"),
          content: stringSchema("File content"),
        })
      ),
    };

    return agentConfig({
      name,
      framework: this.framework,
      description,
      capabilities,
      stateSchema: stateSchema(produces, consumes),
      trustScore: 0.7,
      metadata: {
        model,
        permissions: isObject(permissions) ? permissions : undefined,
      },
    });
  }
}
