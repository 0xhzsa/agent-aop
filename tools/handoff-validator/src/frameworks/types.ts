/**
 * Framework parser types and utilities
 */

import type { AgentConfig, Capability, JSONSchema, StateSchema } from "../types.js";

/** Create a simple JSON Schema */
export function schema(
  type: string,
  properties?: Record<string, JSONSchema>,
  required?: string[]
): JSONSchema {
  const s: JSONSchema = { type };
  if (properties) s.properties = properties;
  if (required) s.required = required;
  return s;
}

/** Create a string schema */
export function stringSchema(description?: string): JSONSchema {
  return { type: "string", ...(description ? { description } : {}) };
}

/** Create a number schema */
export function numberSchema(description?: string): JSONSchema {
  return { type: "number", ...(description ? { description } : {}) };
}

/** Create a boolean schema */
export function booleanSchema(description?: string): JSONSchema {
  return { type: "boolean", ...(description ? { description } : {}) };
}

/** Create an object schema */
export function objectSchema(
  properties?: Record<string, JSONSchema>,
  required?: string[]
): JSONSchema {
  return schema("object", properties, required);
}

/** Create an array schema */
export function arraySchema(items?: JSONSchema): JSONSchema {
  return { type: "array", ...(items ? { items } : {}) };
}

/** Create a capability */
export function capability(
  name: string,
  description: string,
  inputSchema: JSONSchema,
  outputSchema: JSONSchema
): Capability {
  return { name, description, inputSchema, outputSchema };
}

/** Create a state schema */
export function stateSchema(
  produces: Record<string, JSONSchema>,
  consumes: Record<string, JSONSchema>
): StateSchema {
  return { produces, consumes };
}

/** Create an agent config */
export function agentConfig(params: {
  name: string;
  framework: string;
  description: string;
  capabilities: Capability[];
  stateSchema: StateSchema;
  trustRequirements?: AgentConfig["trustRequirements"];
  trustScore?: number;
  metadata?: Record<string, unknown>;
}): AgentConfig {
  return {
    name: params.name,
    framework: params.framework,
    description: params.description,
    capabilities: params.capabilities,
    stateSchema: params.stateSchema,
    ...(params.trustRequirements ? { trustRequirements: params.trustRequirements } : {}),
    ...(params.trustScore !== undefined ? { trustScore: params.trustScore } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };
}

/** Safely get a nested property from an object */
export function getProp(obj: unknown, path: string): unknown {
  if (typeof obj !== "object" || obj === null) return undefined;
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/** Check if a value is a plain object */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep merge two objects */
export function deepMerge<T extends Record<string, unknown>>(base: T, override: T): T {
  const result = { ...base } as T;
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overVal = override[key];
    if (isObject(baseVal) && isObject(overVal)) {
      (result as any)[key] = deepMerge(baseVal, overVal);
    } else {
      (result as any)[key] = overVal;
    }
  }
  return result;
}
