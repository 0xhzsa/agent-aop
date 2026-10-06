/**
 * State schema compatibility checker
 *
 * Validates whether the source agent's output state can be consumed by the target agent.
 */

import type { AgentConfig, Finding } from "./types.js";
import { checkSchemaCompatibility } from "./schema-checker.js";

/** Result of a state schema compatibility check */
export interface StateMatchResult {
  compatible: string[];
  incompatible: string[];
  missing: string[];
  findings: Finding[];
}

/**
 * Check if the source agent's produced state is compatible with the target agent's consumed state.
 *
 * For a handoff to work:
 * - Every state variable the target consumes must be produced by the source
 * - The schemas must be compatible (source output satisfies target input)
 */
export function checkStateCompatibility(
  source: AgentConfig,
  target: AgentConfig
): StateMatchResult {
  const compatible: string[] = [];
  const incompatible: string[] = [];
  const missing: string[] = [];
  const findings: Finding[] = [];

  const sourceProduces = source.stateSchema.produces;
  const targetConsumes = target.stateSchema.consumes;

  // Check each state variable the target needs
  for (const [stateName, targetSchema] of Object.entries(targetConsumes)) {
    const sourceSchema = sourceProduces[stateName];

    if (!sourceSchema) {
      // Check for semantic matches
      const semanticMatch = findSemanticStateMatch(stateName, sourceProduces);
      if (semanticMatch) {
        compatible.push(stateName);
        findings.push({
          category: "state",
          severity: "info",
          message: `State "${stateName}" matched via semantic similarity to "${semanticMatch}"`,
          details: `Source produces "${semanticMatch}" which can satisfy "${stateName}"`,
        });
      } else {
        missing.push(stateName);
        findings.push({
          category: "state",
          severity: "error",
          message: `Missing state: "${stateName}"`,
          details: `Target agent consumes "${stateName}" but source agent doesn't produce it`,
        });
      }
    } else {
      // Check schema compatibility
      const result = checkSchemaCompatibility(sourceSchema, targetSchema, stateName);

      if (result.compatible) {
        compatible.push(stateName);
        if (result.warnings.length > 0) {
          findings.push({
            category: "state",
            severity: "warning",
            message: `State "${stateName}" is compatible with warnings`,
            details: result.warnings.join("; "),
          });
        } else {
          findings.push({
            category: "state",
            severity: "info",
            message: `State "${stateName}" is fully compatible`,
          });
        }
      } else {
        incompatible.push(stateName);
        findings.push({
          category: "state",
          severity: "error",
          message: `State "${stateName}" has incompatible schema`,
          details: result.issues.join("; "),
        });
      }
    }
  }

  // Check for extra state in source (informational)
  for (const stateName of Object.keys(sourceProduces)) {
    if (!targetConsumes[stateName]) {
      findings.push({
        category: "state",
        severity: "info",
        message: `Source produces extra state: "${stateName}"`,
        details: "This state is not consumed by the target but doesn't cause issues",
      });
    }
  }

  return { compatible, incompatible, missing, findings };
}

/**
 * Find a semantically similar state variable in the source
 */
function findSemanticStateMatch(
  targetName: string,
  sourceProduces: Record<string, unknown>
): string | null {
  const targetLower = targetName.toLowerCase();

  // Direct substring match
  for (const name of Object.keys(sourceProduces)) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes(targetLower) || targetLower.includes(nameLower)) {
      return name;
    }
  }

  // Word overlap match
  const targetWords = new Set(targetLower.split(/[_\s-]+/));
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const name of Object.keys(sourceProduces)) {
    const nameWords = new Set(name.toLowerCase().split(/[_\s-]+/));
    const overlap = [...targetWords].filter((w) => nameWords.has(w)).length;
    const score = overlap / Math.max(targetWords.size, nameWords.size);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = name;
    }
  }

  return bestMatch;
}
