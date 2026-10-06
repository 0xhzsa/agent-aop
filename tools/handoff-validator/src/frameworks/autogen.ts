/**
 * AutoGen framework config parser
 *
 * Parses Microsoft AutoGen agent configurations into normalized AgentConfig.
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

export class AutoGenParser implements FrameworkParser {
  framework = "autogen";
  displayName = "Microsoft AutoGen";

  detect(config: unknown): boolean {
    if (!isObject(config)) return false;
    // AutoGen configs have system_message, llm_config, or human_input_mode
    return (
      ("system_message" in config && typeof config.system_message === "string") ||
      ("llm_config" in config && isObject(config.llm_config)) ||
      ("human_input_mode" in config && typeof config.human_input_mode === "string")
    );
  }

  parse(config: unknown): AgentConfig {
    if (!isObject(config)) {
      throw new Error("Invalid AutoGen config: not an object");
    }

    const name = (getProp(config, "name") as string) || "AutoGen Agent";
    const description =
      (getProp(config, "description") as string) || "Agent running on Microsoft AutoGen";
    const systemMessage = (getProp(config, "system_message") as string) || "";
    const humanInputMode = (getProp(config, "human_input_mode") as string) || "NEVER";

    // Extract LLM config
    const llmConfig = getProp(config, "llm_config");
    let model = "gpt-4o";
    let temperature = 0.7;
    if (isObject(llmConfig)) {
      const configList = llmConfig.config_list;
      if (Array.isArray(configList) && configList.length > 0 && isObject(configList[0])) {
        model = (configList[0].model as string) || model;
        temperature = (configList[0].temperature as number) ?? temperature;
      }
    }

    // AutoGen agents are typically code executors
    const capabilities: AgentConfig["capabilities"] = [
      capability(
        "generate_code",
        "Generate Python code",
        objectSchema({ prompt: stringSchema("Code generation prompt") }, ["prompt"]),
        objectSchema({ code: stringSchema("Generated code"), explanation: stringSchema() })
      ),
      capability(
        "execute_code",
        "Execute Python code in a Docker container",
        objectSchema({ code: stringSchema("Code to execute") }, ["code"]),
        objectSchema({ output: stringSchema(), stdout: stringSchema(), stderr: stringSchema(), exitCode: numberSchema() })
      ),
      capability(
        "write_file",
        "Write files to the workspace",
        objectSchema(
          { path: stringSchema("File path"), content: stringSchema("File content") },
          ["path", "content"]
        ),
        objectSchema({ success: booleanSchema() })
      ),
    ];

    // State schema
    const produces: Record<string, JSONSchema> = {
      messages: arraySchema(
        objectSchema({
          role: stringSchema("Message role"),
          content: stringSchema("Message content"),
          name: stringSchema("Agent name"),
        })
      ),
      code: stringSchema("Generated code"),
      executionResult: objectSchema({
        stdout: stringSchema(),
        stderr: stringSchema(),
        exitCode: numberSchema(),
      }),
    };

    const consumes: Record<string, JSONSchema> = {
      task: stringSchema("Task description"),
      context: stringSchema("Additional context"),
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
      trustScore: 0.6,
      metadata: {
        model,
        temperature,
        humanInputMode,
        systemMessage: systemMessage.substring(0, 200),
      },
    });
  }
}
