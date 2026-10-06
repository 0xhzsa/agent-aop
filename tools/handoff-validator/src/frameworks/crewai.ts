/**
 * CrewAI framework config parser
 *
 * Parses CrewAI crew configurations into normalized AgentConfig.
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

export class CrewAIParser implements FrameworkParser {
  framework = "crewai";
  displayName = "CrewAI";

  detect(config: unknown): boolean {
    if (!isObject(config)) return false;
    // CrewAI configs have agents array with role/goal/backstory, or tasks array
    return (
      ("agents" in config && Array.isArray(config.agents)) ||
      ("tasks" in config && Array.isArray(config.tasks)) ||
      ("process" in config && typeof config.process === "string")
    );
  }

  parse(config: unknown): AgentConfig {
    if (!isObject(config)) {
      throw new Error("Invalid CrewAI config: not an object");
    }

    const name = (getProp(config, "name") as string) || "CrewAI Crew";
    const description =
      (getProp(config, "description") as string) || "Agent running on CrewAI";
    const process = (getProp(config, "process") as string) || "sequential";

    // Extract agents as capabilities
    const agents = getProp(config, "agents");
    const capabilities: AgentConfig["capabilities"] = [];

    if (Array.isArray(agents)) {
      for (const agent of agents) {
        if (isObject(agent)) {
          const role = (agent.role as string) || "Agent";
          const goal = (agent.goal as string) || "";
          const agentName = role.toLowerCase().replace(/\s+/g, "_");

          capabilities.push(
            capability(
              agentName,
              `CrewAI agent: ${role} — ${goal}`,
              objectSchema({ task: stringSchema("Task description") }, ["task"]),
              objectSchema({
                result: stringSchema("Task result"),
                output: stringSchema("Agent output"),
              })
            )
          );
        }
      }
    }

    // Extract tasks as capabilities
    const tasks = getProp(config, "tasks");
    if (Array.isArray(tasks)) {
      for (const task of tasks) {
        if (isObject(task)) {
          const taskDesc = (task.description as string) || "Unknown task";
          const taskName = taskDesc.toLowerCase().replace(/\s+/g, "_").substring(0, 30);
          capabilities.push(
            capability(
              taskName,
              `CrewAI task: ${taskDesc}`,
              objectSchema({ context: stringSchema("Task context") }),
              objectSchema({ output: stringSchema("Task output") })
            )
          );
        }
      }
    }

    // Default capabilities
    if (capabilities.length === 0) {
      capabilities.push(
        capability(
          "research",
          "Research a topic",
          objectSchema({ topic: stringSchema("Research topic") }, ["topic"]),
          objectSchema({ findings: arraySchema(stringSchema()), sources: arraySchema(stringSchema()) })
        ),
        capability(
          "write",
          "Write content",
          objectSchema({ topic: stringSchema("Writing topic") }, ["topic"]),
          objectSchema({ content: stringSchema("Written content") })
        )
      );
    }

    // State schema
    const produces: Record<string, JSONSchema> = {
      tasks: arraySchema(
        objectSchema({
          description: stringSchema("Task description"),
          output: stringSchema("Task output"),
          status: stringSchema("Task status"),
        })
      ),
      result: stringSchema("Crew result"),
    };

    const consumes: Record<string, JSONSchema> = {
      task: stringSchema("Task description"),
      context: stringSchema("Additional context"),
    };

    return agentConfig({
      name,
      framework: this.framework,
      description,
      capabilities,
      stateSchema: stateSchema(produces, consumes),
      trustScore: 0.55,
      metadata: {
        process,
        agentCount: Array.isArray(agents) ? agents.length : 0,
        taskCount: Array.isArray(tasks) ? tasks.length : 0,
      },
    });
  }
}
