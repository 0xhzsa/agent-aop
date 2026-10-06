/**
 * LangGraph framework config parser
 *
 * Parses LangGraph state graph configurations into normalized AgentConfig.
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

export class LangGraphParser implements FrameworkParser {
  framework = "langgraph";
  displayName = "LangGraph";

  detect(config: unknown): boolean {
    if (!isObject(config)) return false;
    // LangGraph configs have nodes, edges, or state_schema
    return (
      ("nodes" in config && Array.isArray(config.nodes)) ||
      ("edges" in config && Array.isArray(config.edges)) ||
      ("state_schema" in config && isObject(config.state_schema))
    );
  }

  parse(config: unknown): AgentConfig {
    if (!isObject(config)) {
      throw new Error("Invalid LangGraph config: not an object");
    }

    const name = (getProp(config, "name") as string) || "LangGraph Agent";
    const description =
      (getProp(config, "description") as string) || "Agent running on LangGraph";

    // Extract nodes as capabilities
    const nodes = getProp(config, "nodes");
    const capabilities: AgentConfig["capabilities"] = [];

    if (Array.isArray(nodes)) {
      for (const node of nodes) {
        if (typeof node === "string") {
          capabilities.push(
            capability(
              node,
              `LangGraph node: ${node}`,
              objectSchema({ state: objectSchema() }),
              objectSchema({ state: objectSchema() })
            )
          );
        } else if (isObject(node)) {
          const nodeName = (node.name as string) || (node.id as string) || "unknown";
          const nodeDesc = (node.description as string) || `Node: ${nodeName}`;
          capabilities.push(
            capability(
              nodeName,
              nodeDesc,
              objectSchema({ state: objectSchema() }),
              objectSchema({ state: objectSchema() })
            )
          );
        }
      }
    }

    // Extract state schema
    const stateSchemaRaw = getProp(config, "state_schema");
    const produces: Record<string, JSONSchema> = {};
    const consumes: Record<string, JSONSchema> = {};

    if (isObject(stateSchemaRaw)) {
      for (const [key, value] of Object.entries(stateSchemaRaw)) {
        if (isObject(value)) {
          produces[key] = value as JSONSchema;
          consumes[key] = value as JSONSchema;
        } else {
          produces[key] = stringSchema(`State: ${key}`);
          consumes[key] = stringSchema(`State: ${key}`);
        }
      }
    }

    // Default state schema
    if (Object.keys(produces).length === 0) {
      produces.messages = arraySchema(
        objectSchema({
          role: stringSchema("Message role"),
          content: stringSchema("Message content"),
        })
      );
      produces.result = stringSchema("Graph result");
      consumes.messages = arraySchema(
        objectSchema({
          role: stringSchema("Message role"),
          content: stringSchema("Message content"),
        })
      );
      consumes.input = stringSchema("Graph input");
    }

    // Default capabilities
    if (capabilities.length === 0) {
      capabilities.push(
        capability(
          "process_state",
          "Process graph state",
          objectSchema({ state: objectSchema() }),
          objectSchema({ state: objectSchema() })
        )
      );
    }

    return agentConfig({
      name,
      framework: this.framework,
      description,
      capabilities,
      stateSchema: stateSchema(produces, consumes),
      trustScore: 0.65,
      metadata: {
        nodeCount: Array.isArray(nodes) ? nodes.length : 0,
      },
    });
  }
}
