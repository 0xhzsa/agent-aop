// Main module entry point — exports the full AOP API

export * from "./types.js";
export * from "./envelope.js";
export * from "./state.js";
export * from "./capabilities.js";
export * from "./trust.js";
export * from "./agent.js";

// Re-export version info
export { AOP_VERSION, STATE_SCHEMA_VERSION } from "./types.js";
