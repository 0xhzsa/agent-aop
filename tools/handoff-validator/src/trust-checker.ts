/**
 * Trust compatibility checker
 *
 * Validates whether the source agent meets the target agent's trust requirements.
 */

import type { AgentConfig, Finding } from "./types.js";

/** Result of a trust compatibility check */
export interface TrustMatchResult {
  compatible: boolean;
  sourceScore?: number;
  requiredScore?: number;
  issues: string[];
  findings: Finding[];
}

/**
 * Check if the source agent meets the target agent's trust requirements.
 *
 * For a handoff to be trusted:
 * - The source's trust score must meet the target's minimum requirement
 * - Any required attestations must be present
 */
export function checkTrustCompatibility(
  source: AgentConfig,
  target: AgentConfig
): TrustMatchResult {
  const issues: string[] = [];
  const findings: Finding[] = [];

  const sourceScore = source.trustScore;
  const requiredScore = target.trustRequirements?.minimumTrustScore;
  const requiredAttestations = target.trustRequirements?.requiredAttestations;

  // Check trust score
  if (requiredScore !== undefined) {
    if (sourceScore === undefined) {
      issues.push("Source agent has no trust score");
      findings.push({
        category: "trust",
        severity: "warning",
        message: "Source agent has no trust score",
        details: `Target requires minimum trust score of ${requiredScore}`,
      });
    } else if (sourceScore < requiredScore) {
      issues.push(
        `Source trust score (${sourceScore}) below required minimum (${requiredScore})`
      );
      findings.push({
        category: "trust",
        severity: "error",
        message: `Trust score too low: ${sourceScore} < ${requiredScore}`,
        details: `Source agent's trust score of ${sourceScore} doesn't meet the target's minimum requirement of ${requiredScore}`,
      });
    } else {
      findings.push({
        category: "trust",
        severity: "info",
        message: `Trust score sufficient: ${sourceScore} >= ${requiredScore}`,
      });
    }
  } else {
    findings.push({
      category: "trust",
      severity: "info",
      message: "No trust score requirement from target",
    });
  }

  // Check attestations
  if (requiredAttestations && requiredAttestations.length > 0) {
    const sourceAttestations = (source.metadata?.attestations as string[]) || [];
    const missingAttestations = requiredAttestations.filter(
      (a: string) => !sourceAttestations.includes(a)
    );

    if (missingAttestations.length > 0) {
      issues.push(`Missing attestations: ${missingAttestations.join(", ")}`);
      findings.push({
        category: "trust",
        severity: "error",
        message: `Missing required attestations: ${missingAttestations.join(", ")}`,
        details: `Target requires attestations that source doesn't have`,
      });
    } else {
      findings.push({
        category: "trust",
        severity: "info",
        message: "All required attestations present",
      });
    }
  }

  return {
    compatible: issues.length === 0,
    sourceScore,
    requiredScore,
    issues,
    findings,
  };
}
