/**
 * Main Agent Handoff Validator
 *
 * Orchestrates the full compatibility check between two agent configurations.
 */

import type {
  AgentConfig,
  CompatibilityReport,
  Finding,
  Verdict,
} from "./types.js";
import { checkCapabilityCompatibility } from "./capability-checker.js";
import { checkStateCompatibility } from "./state-checker.js";
import { checkTrustCompatibility } from "./trust-checker.js";

/**
 * Validate whether a handoff from source agent to target agent is possible.
 *
 * Checks:
 * 1. Capability compatibility — can the source do what the target needs?
 * 2. State schema compatibility — can the target consume the source's output state?
 * 3. Trust compatibility — does the source meet the target's trust requirements?
 *
 * Returns a detailed compatibility report with a verdict.
 */
export function validateHandoff(
  source: AgentConfig,
  target: AgentConfig
): CompatibilityReport {
  const findings: Finding[] = [];

  // Run all checks
  const capabilityResult = checkCapabilityCompatibility(source, target);
  const stateResult = checkStateCompatibility(source, target);
  const trustResult = checkTrustCompatibility(source, target);

  // Collect all findings
  findings.push(...capabilityResult.findings);
  findings.push(...stateResult.findings);
  findings.push(...trustResult.findings);

  // Calculate score (0-100)
  const score = calculateScore(capabilityResult, stateResult, trustResult);

  // Determine verdict
  const verdict = determineVerdict(score, capabilityResult, stateResult, trustResult);

  return {
    verdict,
    score,
    sourceAgent: source.name,
    targetAgent: target.name,
    sourceFramework: source.framework,
    targetFramework: target.framework,
    findings,
    capabilityMatch: {
      matched: capabilityResult.matched,
      missing: capabilityResult.missing,
      incompatible: capabilityResult.incompatible,
    },
    stateMatch: {
      compatible: stateResult.compatible,
      incompatible: stateResult.incompatible,
      missing: stateResult.missing,
    },
    trustMatch: {
      compatible: trustResult.compatible,
      sourceScore: trustResult.sourceScore,
      requiredScore: trustResult.requiredScore,
      issues: trustResult.issues,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Calculate an overall compatibility score (0-100)
 */
function calculateScore(
  capability: { matched: string[]; missing: string[]; incompatible: string[] },
  state: { compatible: string[]; incompatible: string[]; missing: string[] },
  trust: { compatible: boolean }
): number {
  // Capability score (40 points max)
  const totalCaps = capability.matched.length + capability.missing.length + capability.incompatible.length;
  const capScore = totalCaps > 0
    ? Math.round((capability.matched.length / totalCaps) * 40)
    : 40;

  // State score (40 points max)
  const totalState = state.compatible.length + state.incompatible.length + state.missing.length;
  const stateScore = totalState > 0
    ? Math.round((state.compatible.length / totalState) * 40)
    : 40;

  // Trust score (20 points max)
  const trustScore = trust.compatible ? 20 : 0;

  return Math.min(100, capScore + stateScore + trustScore);
}

/**
 * Determine the verdict based on scores and critical issues
 */
function determineVerdict(
  score: number,
  capability: { matched: string[]; missing: string[]; incompatible: string[] },
  state: { compatible: string[]; incompatible: string[]; missing: string[] },
  trust: { compatible: boolean }
): Verdict {
  // DEAD: critical incompatibilities
  if (state.incompatible.length > 0 && state.compatible.length === 0) {
    return "DEAD";
  }
  if (capability.incompatible.length > 0 && capability.matched.length === 0) {
    return "DEAD";
  }
  if (state.missing.length > 0 && state.compatible.length === 0) {
    return "DEAD";
  }

  // WATCH: some issues but not dead
  if (score < 70) {
    return "WATCH";
  }
  if (state.incompatible.length > 0) {
    return "WATCH";
  }
  if (capability.incompatible.length > 0) {
    return "WATCH";
  }
  if (!trust.compatible) {
    return "WATCH";
  }

  // ACT: good to go
  if (score >= 80) {
    return "ACT";
  }

  return "WATCH";
}

/**
 * Format a compatibility report as a human-readable string
 */
export function formatReport(report: CompatibilityReport): string {
  const lines: string[] = [];

  // Header
  lines.push("╔══════════════════════════════════════════════════════════╗");
  lines.push("║  Agent Handoff Compatibility Report                      ║");
  lines.push("╚══════════════════════════════════════════════════════════╝");
  lines.push("");

  // Verdict
  const verdictEmoji = report.verdict === "ACT" ? "✅" : report.verdict === "WATCH" ? "⚠️" : "❌";
  lines.push(`${verdictEmoji} Verdict: ${report.verdict}`);
  lines.push(`   Score: ${report.score}/100`);
  lines.push("");

  // Agents
  lines.push(`Source: ${report.sourceAgent} (${report.sourceFramework})`);
  lines.push(`Target: ${report.targetAgent} (${report.targetFramework})`);
  lines.push("");

  // Capability match
  lines.push("── Capability Match ──");
  lines.push(`  Matched: ${report.capabilityMatch.matched.length}`);
  for (const m of report.capabilityMatch.matched) {
    lines.push(`    ✓ ${m}`);
  }
  if (report.capabilityMatch.missing.length > 0) {
    lines.push(`  Missing: ${report.capabilityMatch.missing.length}`);
    for (const m of report.capabilityMatch.missing) {
      lines.push(`    ✗ ${m}`);
    }
  }
  if (report.capabilityMatch.incompatible.length > 0) {
    lines.push(`  Incompatible: ${report.capabilityMatch.incompatible.length}`);
    for (const m of report.capabilityMatch.incompatible) {
      lines.push(`    ✗ ${m}`);
    }
  }
  lines.push("");

  // State match
  lines.push("── State Match ──");
  lines.push(`  Compatible: ${report.stateMatch.compatible.length}`);
  for (const m of report.stateMatch.compatible) {
    lines.push(`    ✓ ${m}`);
  }
  if (report.stateMatch.missing.length > 0) {
    lines.push(`  Missing: ${report.stateMatch.missing.length}`);
    for (const m of report.stateMatch.missing) {
      lines.push(`    ✗ ${m}`);
    }
  }
  if (report.stateMatch.incompatible.length > 0) {
    lines.push(`  Incompatible: ${report.stateMatch.incompatible.length}`);
    for (const m of report.stateMatch.incompatible) {
      lines.push(`    ✗ ${m}`);
    }
  }
  lines.push("");

  // Trust match
  lines.push("── Trust Match ──");
  lines.push(`  Compatible: ${report.trustMatch.compatible ? "Yes" : "No"}`);
  if (report.trustMatch.sourceScore !== undefined) {
    lines.push(`  Source Score: ${report.trustMatch.sourceScore}`);
  }
  if (report.trustMatch.requiredScore !== undefined) {
    lines.push(`  Required Score: ${report.trustMatch.requiredScore}`);
  }
  if (report.trustMatch.issues.length > 0) {
    for (const issue of report.trustMatch.issues) {
      lines.push(`    ✗ ${issue}`);
    }
  }
  lines.push("");

  // Findings
  if (report.findings.length > 0) {
    lines.push("── Findings ──");
    for (const finding of report.findings) {
      const severityEmoji = finding.severity === "error" ? "❌" : finding.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`  ${severityEmoji} [${finding.category}] ${finding.message}`);
      if (finding.details) {
        lines.push(`     ${finding.details}`);
      }
    }
    lines.push("");
  }

  // Timestamp
  lines.push(`Generated: ${report.timestamp}`);

  return lines.join("\n");
}
