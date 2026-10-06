/**
 * Agent Handoff Validator — Public API
 */

export type {
  AgentConfig,
  Capability,
  CompatibilityReport,
  Finding,
  FrameworkParser,
  JSONSchema,
  StateSchema,
  TrustRequirements,
  Verdict,
} from "./types.js";

export { validateHandoff, formatReport } from "./validator.js";
export { checkSchemaCompatibility } from "./schema-checker.js";
export { checkCapabilityCompatibility } from "./capability-checker.js";
export { checkStateCompatibility } from "./state-checker.js";
export { checkTrustCompatibility } from "./trust-checker.js";
export { detectFramework, parseConfig, getParsers } from "./frameworks/index.js";
export {
  agentConfig,
  arraySchema,
  booleanSchema,
  capability,
  numberSchema,
  objectSchema,
  stateSchema,
  stringSchema,
} from "./frameworks/types.js";
