/**
 * Tests for the Agent Handoff Validator
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateHandoff,
  formatReport,
  checkSchemaCompatibility,
  checkCapabilityCompatibility,
  checkStateCompatibility,
  checkTrustCompatibility,
  detectFramework,
  parseConfig,
  agentConfig,
  capability,
  stateSchema,
  stringSchema,
  numberSchema,
  objectSchema,
  arraySchema,
} from "../src/index.js";
import type { AgentConfig, JSONSchema } from "../src/index.js";

// ── Test helpers ──

function makeCapability(
  name: string,
  inputSchema: JSONSchema = objectSchema({ input: stringSchema() }),
  outputSchema: JSONSchema = objectSchema({ output: stringSchema() })
) {
  return capability(name, `Test capability: ${name}`, inputSchema, outputSchema);
}

function makeAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return agentConfig({
    name: "Test Agent",
    framework: "test",
    description: "A test agent",
    capabilities: [makeCapability("test_cap")],
    stateSchema: stateSchema(
      { output: stringSchema("Output") },
      { input: stringSchema("Input") }
    ),
    trustScore: 0.7,
    ...overrides,
  });
}

// ── Schema Compatibility Tests ──

describe("checkSchemaCompatibility", () => {
  it("should return compatible for identical schemas", () => {
    const schema = objectSchema({ name: stringSchema() }, ["name"]);
    const result = checkSchemaCompatibility(schema, schema);
    assert.equal(result.compatible, true);
    assert.equal(result.issues.length, 0);
  });

  it("should detect type mismatch", () => {
    const source = stringSchema();
    const target = numberSchema();
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, false);
    assert.ok(result.issues.some((i) => i.includes("type mismatch")));
  });

  it("should detect missing required properties", () => {
    const source = objectSchema({ name: stringSchema() });
    const target = objectSchema(
      { name: stringSchema(), age: numberSchema() },
      ["name", "age"]
    );
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, false);
    assert.ok(result.issues.some((i) => i.includes("required property")));
  });

  it("should allow additional properties", () => {
    const source = objectSchema(
      { name: stringSchema(), extra: stringSchema() },
      ["name"]
    );
    const target = objectSchema({ name: stringSchema() }, ["name"]);
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, true);
  });

  it("should handle nested objects", () => {
    const source = objectSchema({
      user: objectSchema({ name: stringSchema(), age: numberSchema() }),
    });
    const target = objectSchema({
      user: objectSchema({ name: stringSchema() }, ["name"]),
    });
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, true);
  });

  it("should handle arrays", () => {
    const source = arraySchema(objectSchema({ id: stringSchema() }));
    const target = arraySchema(objectSchema({ id: stringSchema(), name: stringSchema() }));
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, true);
  });

  it("should handle anyOf", () => {
    const source = stringSchema();
    const target = {
      anyOf: [stringSchema(), numberSchema()],
    } as JSONSchema;
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, true);
  });

  it("should handle oneOf", () => {
    const source = stringSchema();
    const target = {
      oneOf: [stringSchema(), numberSchema()],
    } as JSONSchema;
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, true);
  });

  it("should handle allOf", () => {
    const source = objectSchema({ name: stringSchema(), age: numberSchema() });
    const target = {
      allOf: [objectSchema({ name: stringSchema() }, ["name"])],
    } as JSONSchema;
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, true);
  });

  it("should handle $ref gracefully", () => {
    const source = objectSchema({ name: stringSchema() });
    const target = { $ref: "#/definitions/Name" } as JSONSchema;
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, true);
  });

  it("should detect enum incompatibility", () => {
    const source = { type: "string", enum: ["a", "b"] } as JSONSchema;
    const target = { type: "string", enum: ["c", "d"] } as JSONSchema;
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, false);
  });

  it("should handle number/integer compatibility", () => {
    const source = numberSchema();
    const target = { type: "integer" } as JSONSchema;
    const result = checkSchemaCompatibility(source, target);
    assert.equal(result.compatible, true);
  });
});

// ── Capability Compatibility Tests ──

describe("checkCapabilityCompatibility", () => {
  it("should match identical capabilities", () => {
    const source = makeAgent({
      capabilities: [makeCapability("search"), makeCapability("write")],
    });
    const target = makeAgent({
      capabilities: [makeCapability("search"), makeCapability("write")],
    });
    const result = checkCapabilityCompatibility(source, target);
    assert.equal(result.matched.length, 2);
    assert.equal(result.missing.length, 0);
  });

  it("should detect missing capabilities", () => {
    const source = makeAgent({
      capabilities: [makeCapability("search")],
    });
    const target = makeAgent({
      capabilities: [makeCapability("search"), makeCapability("write")],
    });
    const result = checkCapabilityCompatibility(source, target);
    assert.equal(result.matched.length, 1);
    assert.equal(result.missing.length, 1);
    assert.ok(result.missing.includes("write"));
  });

  it("should find semantic matches", () => {
    const source = makeAgent({
      capabilities: [makeCapability("web_search")],
    });
    const target = makeAgent({
      capabilities: [makeCapability("search")],
    });
    const result = checkCapabilityCompatibility(source, target);
    assert.equal(result.matched.length, 1);
  });

  it("should detect extra capabilities as info", () => {
    const source = makeAgent({
      capabilities: [makeCapability("search"), makeCapability("extra")],
    });
    const target = makeAgent({
      capabilities: [makeCapability("search")],
    });
    const result = checkCapabilityCompatibility(source, target);
    assert.equal(result.matched.length, 1);
    assert.ok(result.findings.some((f) => f.message.includes("extra capability")));
  });
});

// ── State Compatibility Tests ──

describe("checkStateCompatibility", () => {
  it("should match compatible state", () => {
    const source = makeAgent({
      stateSchema: stateSchema(
        { output: stringSchema(), data: objectSchema() },
        { input: stringSchema() }
      ),
    });
    const target = makeAgent({
      stateSchema: stateSchema(
        { result: stringSchema() },
        { output: stringSchema() }
      ),
    });
    const result = checkStateCompatibility(source, target);
    assert.equal(result.compatible.length, 1);
    assert.equal(result.missing.length, 0);
  });

  it("should detect missing state", () => {
    const source = makeAgent({
      stateSchema: stateSchema(
        { output: stringSchema() },
        { input: stringSchema() }
      ),
    });
    const target = makeAgent({
      stateSchema: stateSchema(
        { result: stringSchema() },
        { output: stringSchema(), extra: stringSchema() }
      ),
    });
    const result = checkStateCompatibility(source, target);
    assert.equal(result.compatible.length, 1);
    assert.equal(result.missing.length, 1);
    assert.ok(result.missing.includes("extra"));
  });

  it("should detect incompatible state schemas", () => {
    const source = makeAgent({
      stateSchema: stateSchema(
        { output: stringSchema() },
        { input: stringSchema() }
      ),
    });
    const target = makeAgent({
      stateSchema: stateSchema(
        { result: stringSchema() },
        { output: numberSchema() }
      ),
    });
    const result = checkStateCompatibility(source, target);
    assert.equal(result.incompatible.length, 1);
    assert.ok(result.incompatible.includes("output"));
  });
});

// ── Trust Compatibility Tests ──

describe("checkTrustCompatibility", () => {
  it("should pass when trust score is sufficient", () => {
    const source = makeAgent({ trustScore: 0.8 });
    const target = makeAgent({
      trustRequirements: { minimumTrustScore: 0.5 },
    });
    const result = checkTrustCompatibility(source, target);
    assert.equal(result.compatible, true);
  });

  it("should fail when trust score is too low", () => {
    const source = makeAgent({ trustScore: 0.3 });
    const target = makeAgent({
      trustRequirements: { minimumTrustScore: 0.5 },
    });
    const result = checkTrustCompatibility(source, target);
    assert.equal(result.compatible, false);
    assert.ok(result.issues.some((i) => i.includes("trust score")));
  });

  it("should handle missing trust score", () => {
    const source = makeAgent({ trustScore: undefined });
    const target = makeAgent({
      trustRequirements: { minimumTrustScore: 0.5 },
    });
    const result = checkTrustCompatibility(source, target);
    assert.equal(result.compatible, false);
  });

  it("should check attestations", () => {
    const source = makeAgent({
      trustScore: 0.9,
      metadata: { attestations: ["sigstore"] },
    });
    const target = makeAgent({
      trustRequirements: {
        minimumTrustScore: 0.5,
        requiredAttestations: ["sigstore", "slsa"],
      },
    });
    const result = checkTrustCompatibility(source, target);
    assert.equal(result.compatible, false);
    assert.ok(result.issues.some((i) => i.includes("attestations")));
  });
});

// ── Full Validation Tests ──

describe("validateHandoff", () => {
  it("should return ACT for fully compatible agents", () => {
    const source = makeAgent({
      name: "Source Agent",
      framework: "claude-code",
      capabilities: [makeCapability("search"), makeCapability("write")],
      stateSchema: stateSchema(
        { output: stringSchema(), data: objectSchema() },
        { input: stringSchema() }
      ),
      trustScore: 0.9,
    });
    const target = makeAgent({
      name: "Target Agent",
      framework: "openai-assistant",
      capabilities: [makeCapability("search"), makeCapability("write")],
      stateSchema: stateSchema(
        { result: stringSchema() },
        { output: stringSchema() }
      ),
      trustRequirements: { minimumTrustScore: 0.5 },
    });

    const report = validateHandoff(source, target);
    assert.equal(report.verdict, "ACT");
    assert.ok(report.score >= 80);
    assert.equal(report.sourceAgent, "Source Agent");
    assert.equal(report.targetAgent, "Target Agent");
  });

  it("should return WATCH for partially compatible agents", () => {
    const source = makeAgent({
      name: "Source Agent",
      capabilities: [makeCapability("search")],
      stateSchema: stateSchema(
        { output: stringSchema() },
        { input: stringSchema() }
      ),
      trustScore: 0.6,
    });
    const target = makeAgent({
      name: "Target Agent",
      capabilities: [makeCapability("search"), makeCapability("write")],
      stateSchema: stateSchema(
        { result: stringSchema() },
        { output: stringSchema(), extra: stringSchema() }
      ),
      trustRequirements: { minimumTrustScore: 0.8 },
    });

    const report = validateHandoff(source, target);
    assert.equal(report.verdict, "WATCH");
    assert.ok(report.score < 80);
  });

  it("should return DEAD for incompatible agents", () => {
    const source = makeAgent({
      name: "Source Agent",
      capabilities: [makeCapability("search")],
      stateSchema: stateSchema(
        { output: stringSchema() },
        { input: stringSchema() }
      ),
      trustScore: 0.3,
    });
    const target = makeAgent({
      name: "Target Agent",
      capabilities: [makeCapability("write")],
      stateSchema: stateSchema(
        { result: stringSchema() },
        { output: numberSchema() }
      ),
      trustRequirements: { minimumTrustScore: 0.9 },
    });

    const report = validateHandoff(source, target);
    assert.equal(report.verdict, "DEAD");
  });

  it("should include all findings in report", () => {
    const source = makeAgent({
      capabilities: [makeCapability("search")],
      stateSchema: stateSchema(
        { output: stringSchema() },
        { input: stringSchema() }
      ),
    });
    const target = makeAgent({
      capabilities: [makeCapability("search"), makeCapability("write")],
      stateSchema: stateSchema(
        { result: stringSchema() },
        { output: stringSchema(), extra: stringSchema() }
      ),
    });

    const report = validateHandoff(source, target);
    assert.ok(report.findings.length > 0);
    assert.ok(report.capabilityMatch.missing.includes("write"));
    assert.ok(report.stateMatch.missing.includes("extra"));
  });
});

// ── Format Report Tests ──

describe("formatReport", () => {
  it("should produce a non-empty string", () => {
    const source = makeAgent({ name: "A" });
    const target = makeAgent({ name: "B" });
    const report = validateHandoff(source, target);
    const formatted = formatReport(report);
    assert.ok(formatted.length > 0);
    assert.ok(formatted.includes("A"));
    assert.ok(formatted.includes("B"));
  });

  it("should include verdict in output", () => {
    const source = makeAgent({ name: "A" });
    const target = makeAgent({ name: "B" });
    const report = validateHandoff(source, target);
    const formatted = formatReport(report);
    assert.ok(formatted.includes(report.verdict));
  });
});

// ── Framework Detection Tests ──

describe("detectFramework", () => {
  it("should detect Claude Code configs", () => {
    const parser = detectFramework({
      model: "claude-sonnet-4-20250514",
      permissions: { allow: ["read_file", "write_file"] },
    });
    assert.equal(parser.framework, "claude-code");
  });

  it("should detect OpenAI Assistant configs", () => {
    const parser = detectFramework({
      name: "My Assistant",
      instructions: "You are helpful",
      model: "gpt-4o",
      tools: [{ type: "function", function: { name: "search", description: "Search" } }],
    });
    assert.equal(parser.framework, "openai-assistant");
  });

  it("should detect OpenAI Agents SDK configs", () => {
    const parser = detectFramework({
      name: "Agent",
      handoffs: ["other-agent"],
      tools: ["search"],
    });
    assert.equal(parser.framework, "openai-agents");
  });

  it("should detect AutoGen configs", () => {
    const parser = detectFramework({
      name: "AutoGen Agent",
      system_message: "You are a helpful assistant",
      human_input_mode: "NEVER",
    });
    assert.equal(parser.framework, "autogen");
  });

  it("should detect LangGraph configs", () => {
    const parser = detectFramework({
      name: "LangGraph Agent",
      nodes: ["node1", "node2"],
      edges: [["node1", "node2"]],
    });
    assert.equal(parser.framework, "langgraph");
  });

  it("should detect CrewAI configs", () => {
    const parser = detectFramework({
      name: "Crew",
      agents: [{ role: "Researcher", goal: "Research topics" }],
      tasks: [{ description: "Research AI" }],
    });
    assert.equal(parser.framework, "crewai");
  });

  it("should detect Google ADK configs", () => {
    const parser = detectFramework({
      name: "ADK Agent",
      instruction: "You are helpful",
      tools: ["search"],
    });
    assert.equal(parser.framework, "google-adk");
  });

  it("should fall back to custom parser", () => {
    const parser = detectFramework({ name: "Custom", something: "else" });
    assert.equal(parser.framework, "custom");
  });
});

// ── Parse Config Tests ──

describe("parseConfig", () => {
  it("should parse Claude Code config", () => {
    const config = {
      model: "claude-sonnet-4-20250514",
      permissions: { allow: ["read_file", "write_file", "bash"] },
    };
    const { parser, agentConfig } = parseConfig(config);
    assert.equal(parser.framework, "claude-code");
    assert.ok(agentConfig.capabilities.length >= 3);
  });

  it("should parse OpenAI Assistant config", () => {
    const config = {
      name: "Assistant",
      instructions: "Be helpful",
      model: "gpt-4o",
      tools: [
        { type: "function", function: { name: "search", description: "Search the web" } },
      ],
    };
    const { parser, agentConfig } = parseConfig(config);
    assert.equal(parser.framework, "openai-assistant");
    assert.equal(agentConfig.name, "Assistant");
    assert.ok(agentConfig.capabilities.length >= 1);
  });

  it("should parse custom config", () => {
    const config = {
      name: "My Agent",
      framework: "my-framework",
      capabilities: [
        {
          name: "my_cap",
          description: "My capability",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        },
      ],
      stateSchema: {
        produces: { output: { type: "string" } },
        consumes: { input: { type: "string" } },
      },
    };
    const { parser, agentConfig } = parseConfig(config);
    assert.equal(parser.framework, "custom");
    assert.equal(agentConfig.name, "My Agent");
    assert.equal(agentConfig.capabilities.length, 1);
  });
});

// ── Cross-Framework Validation Tests ──

describe("Cross-framework handoff validation", () => {
  it("should validate Claude Code → OpenAI Assistant handoff", () => {
    const claudeConfig = {
      model: "claude-sonnet-4-20250514",
      permissions: { allow: ["read_file", "write_file", "bash"] },
    };
    const openaiConfig = {
      name: "OpenAI Assistant",
      instructions: "Be helpful",
      model: "gpt-4o",
      tools: [{ type: "function", function: { name: "search", description: "Search" } }],
    };

    const { agentConfig: source } = parseConfig(claudeConfig);
    const { agentConfig: target } = parseConfig(openaiConfig);

    const report = validateHandoff(source, target);
    assert.ok(report.verdict === "ACT" || report.verdict === "WATCH");
    assert.ok(report.score > 0);
  });

  it("should validate AutoGen → LangGraph handoff", () => {
    const autogenConfig = {
      name: "AutoGen Agent",
      system_message: "You are a helpful assistant",
      human_input_mode: "NEVER",
    };
    const langgraphConfig = {
      name: "LangGraph Agent",
      nodes: ["process", "output"],
      edges: [["process", "output"]],
    };

    const { agentConfig: source } = parseConfig(autogenConfig);
    const { agentConfig: target } = parseConfig(langgraphConfig);

    const report = validateHandoff(source, target);
    assert.ok(["ACT", "WATCH", "DEAD"].includes(report.verdict));
  });

  it("should validate CrewAI → Google ADK handoff", () => {
    // Note: CrewAI and Google ADK have very different state schemas,
    // so DEAD is a valid verdict here — the test checks the report is generated.
    const crewaiConfig = {
      name: "Crew",
      agents: [{ role: "Researcher", goal: "Research topics" }],
      tasks: [{ description: "Research AI" }],
    };
    const adkConfig = {
      name: "ADK Agent",
      instruction: "You are helpful",
      tools: ["search"],
    };

    const { agentConfig: source } = parseConfig(crewaiConfig);
    const { agentConfig: target } = parseConfig(adkConfig);

    const report = validateHandoff(source, target);
    assert.ok(["ACT", "WATCH", "DEAD"].includes(report.verdict));
  });
});
