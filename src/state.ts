// State serialization for agent handoffs

import {
  StateSnapshot,
  StateContext,
  STATE_SCHEMA_VERSION,
} from "./types.js";
import { encodeBase64, decodeBase64 } from "./envelope.js";

/**
 * Create a state snapshot from variables
 */
export function createStateSnapshot(
  variables: Record<string, unknown>,
  options?: {
    files?: { path: string; content: string; mimeType: string }[];
    context?: Partial<StateContext>;
  }
): StateSnapshot {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    variables: deepCopyVariables(variables),
    files: (options?.files || []).map((f) => ({
      path: f.path,
      content: encodeBase64(f.content),
      mimeType: f.mimeType,
    })),
    context: {
      conversationHistory: options?.context?.conversationHistory || [],
      decisionsMade: options?.context?.decisionsMade || [],
      constraints: options?.context?.constraints || [],
    },
  };
}

/**
 * Deep copy variables — ensures no shared references in state
 */
function deepCopyVariables(obj: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    // Handle non-JSON-serializable values by converting to strings
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      try {
        result[key] = JSON.parse(JSON.stringify(value));
      } catch {
        result[key] = String(value);
      }
    }
    return result;
  }
}

/**
 * Extract variables from a state snapshot
 */
export function getVariables(snapshot: StateSnapshot): Record<string, unknown> {
  return snapshot.variables;
}

/**
 * Get a variable by path (e.g., "user.name" or "task.progress")
 */
export function getVariable(
  snapshot: StateSnapshot,
  path: string
): unknown {
  const parts = path.split(".");
  let current: any = snapshot.variables;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Set a variable by path
 */
export function setVariable(
  snapshot: StateSnapshot,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  let current: any = snapshot.variables;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]!] = value;
}

/**
 * Deep merge two objects — nested objects are merged recursively
 */
function deepMerge(base: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] !== null &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Merge state from another snapshot
 */
export function mergeState(
  base: StateSnapshot,
  incoming: StateSnapshot
): StateSnapshot {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    variables: deepMerge(base.variables, deepCopyVariables(incoming.variables)),
    files: [...base.files, ...incoming.files],
    context: {
      conversationHistory: [
        ...base.context.conversationHistory,
        ...incoming.context.conversationHistory,
      ],
      decisionsMade: [
        ...base.context.decisionsMade,
        ...incoming.context.decisionsMade,
      ],
      constraints: [...base.context.constraints, ...incoming.context.constraints],
    },
  };
}

/**
 * Get file content from a state snapshot
 */
export function getFileContent(snapshot: StateSnapshot, path: string): string | null {
  const file = snapshot.files.find((f) => f.path === path);
  if (!file) return null;
  return decodeBase64(file.content);
}

/**
 * Add a file to a state snapshot
 */
export function addFile(
  snapshot: StateSnapshot,
  file: { path: string; content: string; mimeType: string }
): void {
  snapshot.files.push({
    path: file.path,
    content: encodeBase64(file.content),
    mimeType: file.mimeType,
  });
}

/**
 * Serialize a state snapshot to a transport-safe format
 */
export function serializeState(snapshot: StateSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * Deserialize a state snapshot from transport format
 */
export function deserializeState(json: string): StateSnapshot | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed.schemaVersion !== STATE_SCHEMA_VERSION) return null;
    return parsed as StateSnapshot;
  } catch {
    return null;
  }
}

/**
 * Create a state diff (what changed between two snapshots)
 */
export function diffState(
  before: StateSnapshot,
  after: StateSnapshot
): { added: string[]; changed: string[]; removed: string[] } {
  const beforeKeys = Object.keys(before.variables);
  const afterKeys = Object.keys(after.variables);

  const added = afterKeys.filter((k) => !beforeKeys.includes(k));
  const removed = beforeKeys.filter((k) => !afterKeys.includes(k));
  const changed: string[] = [];

  for (const key of beforeKeys.filter((k) => afterKeys.includes(k))) {
    if (JSON.stringify(before.variables[key]) !== JSON.stringify(after.variables[key])) {
      changed.push(key);
    }
  }

  return { added, changed, removed };
}
