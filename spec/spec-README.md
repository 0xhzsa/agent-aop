# Agent Orchestration Protocol (AOP) — Reference Implementation

**Status:** v0.1.0 — Core message types implemented, cross-framework handoff demonstrated

## Quick Start

```bash
npm install
npm run build
npm test
```

## What This Is

AOP is a universal protocol for AI agent interoperability. It defines:
1. **Message envelope** — a standard format for all agent-to-agent communication
2. **State serialization** — framework-agnostic state snapshots for handoffs
3. **Capability declaration** — machine-readable capability discovery
4. **Trust anchoring** — cryptographic signatures for authenticity

## What This Is NOT

- Not another agent framework
- Not a replacement for OpenAI Agents SDK, LangGraph, CrewAI, etc.
- It's the **protocol layer** that makes them work together

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Message envelope | ✅ Done | Typed, serializable |
| State serialization | ✅ Done | JSON-based, extensible |
| Capability registry | ✅ Done | Full schema support |
| Trust verification | ✅ Done | Ed25519 signatures |
| Cross-framework demo | 🚧 In progress | OpenAI ↔ Claude handoff |
| Benchmark suite | ⬜ Planned | |

## Architecture

```
src/
├── envelope.ts        # Message envelope definition and serialization
├── state.ts           # State snapshot serialization
├── capabilities.ts    # Capability declaration and discovery
├── trust.ts           # Signature generation and verification
├── agent.ts           # Base agent class implementing AOP
├── index.ts           # Public API
└── types.ts           # Shared type definitions
```

## License

MIT
