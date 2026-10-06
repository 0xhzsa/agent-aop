// Capability registry for agent discovery and declaration

import {
  Capability,
  CapabilityRegistry,
  AgentId,
} from "./types.js";

/**
 * Create a capability declaration
 */
export function createCapability(
  name: string,
  description: string,
  schema: Record<string, unknown>,
  examples?: unknown[]
): Capability {
  return {
    name,
    description,
    schema,
    ...(examples ? { examples } : {}),
  };
}

/**
 * Create a capability registry for an agent
 */
export function createCapabilityRegistry(
  agentId: AgentId,
  capabilities: Capability[],
  signature: string
): CapabilityRegistry {
  return {
    agentId,
    capabilities,
    declaredAt: new Date().toISOString(),
    signature,
  };
}

/**
 * Query capabilities by name
 */
export function findCapability(
  registries: CapabilityRegistry[],
  capabilityName: string
): { registry: CapabilityRegistry; capability: Capability } | null {
  for (const registry of registries) {
    for (const capability of registry.capabilities) {
      if (capability.name === capabilityName) {
        return { registry, capability };
      }
    }
  }
  return null;
}

/**
 * Query capabilities by semantic match (name contains query)
 */
export function searchCapabilities(
  registries: CapabilityRegistry[],
  query: string
): { registry: CapabilityRegistry; capability: Capability; score: number }[] {
  const results: { registry: CapabilityRegistry; capability: Capability; score: number }[] = [];
  const queryLower = query.toLowerCase();

  for (const registry of registries) {
    for (const capability of registry.capabilities) {
      const nameLower = capability.name.toLowerCase();
      const descLower = capability.description.toLowerCase();

      // Simple scoring: name match > description match
      let score = 0;
      if (nameLower === queryLower) score += 10;
      if (nameLower.includes(queryLower)) score += 5;
      if (descLower.includes(queryLower)) score += 3;

      if (score > 0) {
        results.push({ registry, capability, score });
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Validate that an agent's capabilities match a required set
 */
export function hasRequiredCapabilities(
  registry: CapabilityRegistry,
  required: string[]
): { has: boolean; missing: string[] } {
  const available = new Set(registry.capabilities.map((c) => c.name));
  const missing = required.filter((r) => !available.has(r));

  return {
    has: missing.length === 0,
    missing,
  };
}

/**
 * Filter agents by minimum trust score
 */
export function filterByTrust(
  registries: CapabilityRegistry[]
): CapabilityRegistry[] {
  // Note: Trust scores are stored in the agent identity, not the registry.
  // In a real implementation, this would check against a trust store.
  // For the reference implementation, we return all registries.
  return registries;
}

/**
 * Format capabilities for human-readable display
 */
export function formatCapabilities(registry: CapabilityRegistry): string {
  const lines: string[] = [
    `Agent: ${registry.agentId}`,
    `Declared: ${registry.declaredAt}`,
    `Capabilities:`,
  ];

  for (const cap of registry.capabilities) {
    lines.push(`  • ${cap.name} — ${cap.description}`);
  }

  return lines.join("\n");
}
