/**
 * Custom framework config parser
 *
 * Parses custom/generic agent configurations into normalized AgentConfig.
 * This is the fallback parser for unknown frameworks.
 */

import type { AgentConfig, FrameworkParser, JSONSchema } from "../types.js";
import {
  agentConfig,
  capability,
  getProp,
  isObject,
  objectSchema,
  stateSchema,
  stringSchema,
} from "./types.js";

export class CustomParser implements FrameworkParser {
  framework = "custom";
  displayName = "Custom";

  detect(config: unknown): boolean {
    // Custom parser accepts anything that's an object
    return isObject(config);
  }

  parse(config: unknown): AgentConfig {
    if (!isObject(config)) {
      throw new Error("Invalid custom config: not an object");
    }

    const name = (getProp(config, "name") as string) || "Custom Agent";
    const description =
      (getProp(config, "description") as string) || "Custom agent configuration";
    const framework = (getProp(config, "framework") as string) || "custom";

    // Extract capabilities
    const capabilities: AgentConfig["capabilities"] = [];
    const capsRaw = getProp(config, "capabilities");

    if (Array.isArray(capsRaw)) {
      for (const cap of capsRaw) {
        if (isObject(cap)) {
          const capName = (cap.name as string) || "unknown";
          const capDesc = (cap.description as string) || `Capability: ${capName}`;
          const inputSchema = isObject(cap.inputSchema)
            ? (cap.inputSchema as JSONSchema)
            : objectSchema({ input: stringSchema() });
          const outputSchema = isObject(cap.outputSchema)
            ? (cap.outputSchema as JSONSchema)
            : objectSchema({ output: stringSchema() });
          capabilities.push(capability(capName, capDesc, inputSchema, outputSchema));
        } else if (typeof cap === "string") {
          capabilities.push(
            capability(
              cap,
              `Capability: ${cap}`,
              objectSchema({ input: stringSchema() }),
              objectSchema({ output: stringSchema() })
            )
          );
        }
      }
    }

    // Extract state schema
    const produces: Record<string, JSONSchema> = {};
    const consumes: Record<string, JSONSchema> = {};
    const stateSchemaRaw = getProp(config, "stateSchema");

    if (isObject(stateSchemaRaw)) {
      const producesRaw = stateSchemaRaw.produces;
      const consumesRaw = stateSchemaRaw.consumes;

      if (isObject(producesRaw)) {
        for (const [key, value] of Object.entries(producesRaw)) {
          produces[key] = isObject(value) ? (value as JSONSchema) : stringSchema(`State: ${key}`);
        }
      }
      if (isObject(consumesRaw)) {
        for (const [key, value] of Object.entries(consumesRaw)) {
          consumes[key] = isObject(value) ? (value as JSONSchema) : stringSchema(`State: ${key}`);
        }
      }
    }

    // Defaults
    if (capabilities.length === 0) {
      capabilities.push(
        capability(
          "process",
          "Process input",
          objectSchema({ input: stringSchema() }),
          objectSchema({ output: stringSchema() })
        )
      );
    }

    if (Object.keys(produces).length === 0) {
      produces.output = stringSchema("Agent output");
    }
    if (Object.keys(consumes).length === 0) {
      consumes.input = stringSchema("Agent input");
    }

    // Trust requirements
    const trustReqRaw = getProp(config, "trustRequirements");
    let trustRequirements: AgentConfig["trustRequirements"];
    if (isObject(trustReqRaw)) {
      trustRequirements = {
        minimumTrustScore: trustReqRaw.minimumTrustScore as number | undefined,
        requiredAttestations: Array.isArray(trustReqRaw.requiredAttestations)
          ? (trustReqRaw.requiredAttestations as string[])
          : undefined,
      };
    }

    return agentConfig({
      name,
      framework,
      description,
      capabilities,
      stateSchema: stateSchema(produces, consumes),
      trustRequirements,
      trustScore: getProp(config, "trustScore") as number | undefined,
    });
  }
}
