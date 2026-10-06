/**
 * Core types for the Agent Handoff Validator
 */

/** JSON Schema property definition */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  enum?: unknown[];
  additionalProperties?: boolean | JSONSchema;
  $ref?: string;
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  // Number constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  // Array constraints
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // Object constraints
  minProperties?: number;
  maxProperties?: number;
  patternProperties?: Record<string, JSONSchema>;
  dependencies?: Record<string, string[] | JSONSchema>;
}

/** A capability that an agent can perform */
export interface Capability {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}

/** State schema — what an agent produces and consumes */
export interface StateSchema {
  /** State variables this agent produces (outputs) */
  produces: Record<string, JSONSchema>;
  /** State variables this agent consumes (inputs) */
  consumes: Record<string, JSONSchema>;
}

/** Trust requirements for accepting a handoff */
export interface TrustRequirements {
  minimumTrustScore?: number;
  requiredAttestations?: string[];
}

/** Normalized agent configuration */
export interface AgentConfig {
  name: string;
  framework: string;
  description: string;
  capabilities: Capability[];
  stateSchema: StateSchema;
  trustRequirements?: TrustRequirements;
  trustScore?: number;
  metadata?: Record<string, unknown>;
}

/** Compatibility verdict */
export type Verdict = "ACT" | "WATCH" | "DEAD";

/** A single compatibility finding */
export interface Finding {
  category: "capability" | "state" | "trust" | "framework";
  severity: "info" | "warning" | "error";
  message: string;
  details?: string;
}

/** Compatibility report for a handoff */
export interface CompatibilityReport {
  verdict: Verdict;
  score: number;
  sourceAgent: string;
  targetAgent: string;
  sourceFramework: string;
  targetFramework: string;
  findings: Finding[];
  capabilityMatch: {
    matched: string[];
    missing: string[];
    incompatible: string[];
  };
  stateMatch: {
    compatible: string[];
    incompatible: string[];
    missing: string[];
  };
  trustMatch: {
    compatible: boolean;
    sourceScore?: number;
    requiredScore?: number;
    issues: string[];
  };
  timestamp: string;
}

/** Framework parser interface */
export interface FrameworkParser {
  /** Framework identifier */
  framework: string;
  /** Human-readable name */
  displayName: string;
  /** Check if a config matches this framework */
  detect(config: unknown): boolean;
  /** Parse a config into normalized AgentConfig */
  parse(config: unknown): AgentConfig;
}
