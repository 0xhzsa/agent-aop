/**
 * Capability compatibility checker
 *
 * Checks if the source agent's capabilities can satisfy the target agent's requirements.
 */

import type { AgentConfig, Capability, Finding } from "./types.js";

/** Result of a capability compatibility check */
export interface CapabilityMatchResult {
  matched: string[];
  missing: string[];
  incompatible: string[];
  findings: Finding[];
}

/**
 * Check if the source agent's capabilities are compatible with the target agent's needs.
 *
 * The source agent produces capabilities (what it can do).
 * The target agent consumes capabilities (what it needs from the source).
 *
 * For a handoff to work:
 * - The source must have capabilities that the target needs
 * - The source's output schemas must be compatible with the target's input schemas
 */
export function checkCapabilityCompatibility(
  source: AgentConfig,
  target: AgentConfig
): CapabilityMatchResult {
  const matched: string[] = [];
  const missing: string[] = [];
  const incompatible: string[] = [];
  const findings: Finding[] = [];

  const sourceCaps = new Map<string, Capability>(source.capabilities.map((c: Capability) => [c.name, c]));
  const targetCaps = new Map<string, Capability>(target.capabilities.map((c: Capability) => [c.name, c]));

  // Check each target capability
  for (const [targetCapName, targetCap] of targetCaps.entries()) {
    const sourceCap = sourceCaps.get(targetCapName);

    if (!sourceCap) {
      // Check for semantic matches (similar names)
      const semanticMatch = findSemanticMatch(targetCapName, sourceCaps);
      if (semanticMatch) {
        matched.push(targetCapName);
        findings.push({
          category: "capability",
          severity: "info",
          message: `Capability "${targetCapName}" matched via semantic similarity to "${semanticMatch.name}"`,
          details: `Source has "${semanticMatch.name}" which can fulfill "${targetCapName}"`,
        });
      } else {
        missing.push(targetCapName);
        findings.push({
          category: "capability",
          severity: "warning",
          message: `Missing capability: "${targetCapName}"`,
          details: `Target agent needs "${targetCapName}" but source agent doesn't provide it`,
        });
      }
    } else {
      // Check schema compatibility
      const inputCompat = checkInputSchemaCompatibility(sourceCap, targetCap);
      const outputCompat = checkOutputSchemaCompatibility(sourceCap, targetCap);

      if (inputCompat.compatible && outputCompat.compatible) {
        matched.push(targetCapName);
        findings.push({
          category: "capability",
          severity: "info",
          message: `Capability "${targetCapName}" is fully compatible`,
        });
      } else {
        incompatible.push(targetCapName);
        const allIssues = [...inputCompat.issues, ...outputCompat.issues];
        findings.push({
          category: "capability",
          severity: "error",
          message: `Capability "${targetCapName}" has incompatible schemas`,
          details: allIssues.join("; "),
        });
      }
    }
  }

  // Check for extra capabilities in source (informational)
  for (const sourceCapName of sourceCaps.keys()) {
    if (!targetCaps.has(sourceCapName)) {
      findings.push({
        category: "capability",
        severity: "info",
        message: `Source has extra capability: "${sourceCapName}"`,
        details: "This capability is not needed by the target but doesn't cause issues",
      });
    }
  }

  return { matched, missing, incompatible, findings };
}

/**
 * Find a semantically similar capability in the source
 */
function findSemanticMatch(
  targetName: string,
  sourceCaps: Map<string, Capability>
): Capability | null {
  const targetLower = targetName.toLowerCase();

  // Direct substring match
  for (const [name, cap] of sourceCaps) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes(targetLower) || targetLower.includes(nameLower)) {
      return cap;
    }
  }

  // Word overlap match
  const targetWords = new Set(targetLower.split(/[_\s-]+/));
  let bestMatch: Capability | null = null;
  let bestScore = 0;

  for (const [name, cap] of sourceCaps) {
    const nameWords = new Set(name.toLowerCase().split(/[_\s-]+/));
    const overlap = [...targetWords].filter((w) => nameWords.has(w)).length;
    const score = overlap / Math.max(targetWords.size, nameWords.size);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = cap;
    }
  }

  return bestMatch;
}

/**
 * Check if source's input schema is compatible with target's input schema
 */
function checkInputSchemaCompatibility(
  source: Capability,
  target: Capability
): { compatible: boolean; issues: string[] } {
  const issues: string[] = [];

  // The source's input schema should be able to accept what the target can provide
  // This is a simplified check — in practice, you'd want more sophisticated logic
  if (source.inputSchema.type && target.inputSchema.type) {
    if (source.inputSchema.type !== target.inputSchema.type) {
      // Check for compatible types
      if (
        !(
          (source.inputSchema.type === "object" && target.inputSchema.type === "object") ||
          (source.inputSchema.type === "string" && target.inputSchema.type === "string") ||
          (source.inputSchema.type === "array" && target.inputSchema.type === "array")
        )
      ) {
        issues.push(
          `Input type mismatch: source expects "${source.inputSchema.type}", target provides "${target.inputSchema.type}"`
        );
      }
    }
  }

  return { compatible: issues.length === 0, issues };
}

/**
 * Check if source's output schema is compatible with target's output schema
 */
function checkOutputSchemaCompatibility(
  source: Capability,
  target: Capability
): { compatible: boolean; issues: string[] } {
  const issues: string[] = [];

  // The source's output should satisfy what the target expects
  if (source.outputSchema.type && target.outputSchema.type) {
    if (source.outputSchema.type !== target.outputSchema.type) {
      if (
        !(
          (source.outputSchema.type === "object" && target.outputSchema.type === "object") ||
          (source.outputSchema.type === "string" && target.outputSchema.type === "string") ||
          (source.outputSchema.type === "array" && target.outputSchema.type === "array")
        )
      ) {
        issues.push(
          `Output type mismatch: source produces "${source.outputSchema.type}", target expects "${target.outputSchema.type}"`
        );
      }
    }
  }

  return { compatible: issues.length === 0, issues };
}
