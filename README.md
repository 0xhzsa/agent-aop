# Agent Orchestration Protocol (AOP)

**Version:** v0.1.0 (Draft)
**Goal:** A universal protocol for how AI agents communicate, hand off state, and coordinate across frameworks.

## The Problem

Every agent framework reinvents agent-to-agent communication differently:
- OpenAI Swarm: JSON-based function calls, no state persistence
- Microsoft AutoGen: Python objects in memory, not network-addressable
- CrewAI: YAML task definitions, framework-specific
- LangGraph: State machines, but tied to LangChain

**Nobody has built the protocol layer.** That's the gap AOP fills.

## The Vision

In 2030, an agent built with Framework A handss work to an agent built with Framework B as naturally as HTTP requests cross cloud providers. AOP is that standard.

## Core Concepts

1. **Message Envelope** — Every message between agents is self-describing
2. **State Handoff** — State snapshots are serializable and framework-agnostic  
3. **Capability Declaration** — Agents declare what they can do in a machine-readable format
4. **Trust Anchoring** — Cryptographic attestation of agent identity and capability provenance

## Repository Structure

```
agent-aop/
├── spec/           # Protocol specification (Markdown)
├── src/            # Reference implementation (TypeScript)
├── benches/        # Benchmark suite
├── examples/       # Multi-framework demos
└── agents/         # The three agent scripts
    ├── position-scout.ts
    ├── ship-agent.ts  
    └── quartermaster.ts
```

## Status

🚧 v0.1.0 draft — building reference implementation now.
