/**
 * CLI entry point for the Agent Handoff Validator
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parseConfig } from "./frameworks/index.js";
import { formatReport, validateHandoff } from "./validator.js";

/** CLI arguments */
interface CliArgs {
  source: string;
  target: string;
  format: "text" | "json";
  output?: string;
  help: boolean;
}

/** Parse command-line arguments */
function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    source: "",
    target: "",
    format: "text",
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    switch (arg) {
      case "-s":
      case "--source":
        result.source = args[++i] || "";
        break;
      case "-t":
      case "--target":
        result.target = args[++i] || "";
        break;
      case "-f":
      case "--format":
        result.format = (args[++i] as "text" | "json") || "text";
        break;
      case "-o":
      case "--output":
        result.output = args[++i];
        break;
      case "-h":
      case "--help":
        result.help = true;
        break;
    }
  }

  return result;
}

/** Print usage information */
function printUsage(): void {
  console.log(`
Agent Handoff Validator — Check if two AI agent frameworks can hand off work via AOP

Usage:
  handoff-validator --source <config-a> --target <config-b> [options]

Options:
  -s, --source <file>    Path to source agent config (the one handing off)
  -t, --target <file>    Path to target agent config (the one receiving)
  -f, --format <format>  Output format: "text" (default) or "json"
  -o, --output <file>    Write report to file instead of stdout
  -h, --help             Show this help message

Examples:
  handoff-validator -s ./claude-settings.json -t ./openai-assistant.json
  handoff-validator -s ./agent-a.yaml -t ./agent-b.yaml -f json -o report.json
  handoff-validator -s ./crewai-config.json -t ./langgraph-config.json

Supported frameworks:
  • Claude Code
  • OpenAI Assistant
  • OpenAI Agents SDK
  • Microsoft AutoGen
  • LangGraph
  • CrewAI
  • Google ADK
  • Custom (generic)
`);
}

/** Read and parse a config file */
function loadConfig(filePath: string): unknown {
  const resolved = resolve(filePath);
  const content = readFileSync(resolved, "utf-8");

  // Try JSON first
  try {
    return JSON.parse(content);
  } catch {
    // If not JSON, try YAML-like parsing (simple key: value)
    // For now, we only support JSON
    throw new Error(
      `Failed to parse config file: ${filePath}\nOnly JSON config files are supported.`
    );
  }
}

/** Main CLI entry point */
export function runCli(args: string[]): number {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printUsage();
    return 0;
  }

  if (!parsed.source || !parsed.target) {
    console.error("Error: --source and --target are required");
    printUsage();
    return 1;
  }

  try {
    // Load and parse configs
    const sourceRaw = loadConfig(parsed.source);
    const targetRaw = loadConfig(parsed.target);

    const { parser: sourceParser, agentConfig: sourceConfig } = parseConfig(sourceRaw);
    const { parser: targetParser, agentConfig: targetConfig } = parseConfig(targetRaw);

    console.log(`Source: ${sourceConfig.name} (${sourceParser.displayName})`);
    console.log(`Target: ${targetConfig.name} (${targetParser.displayName})`);
    console.log("");

    // Run validation
    const report = validateHandoff(sourceConfig, targetConfig);

    // Output
    let output: string;
    if (parsed.format === "json") {
      output = JSON.stringify(report, null, 2);
    } else {
      output = formatReport(report);
    }

    if (parsed.output) {
      writeFileSync(parsed.output, output, "utf-8");
      console.log(`Report written to: ${parsed.output}`);
    } else {
      console.log(output);
    }

    // Exit code based on verdict
    if (report.verdict === "DEAD") return 2;
    if (report.verdict === "WATCH") return 1;
    return 0;
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    return 1;
  }
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("cli.js");
if (isMain) {
  const exitCode = runCli(process.argv.slice(2));
  process.exit(exitCode);
}
