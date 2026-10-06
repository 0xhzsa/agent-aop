# Agent Orchestration Protocol (AOP) Specification
## Version 0.1.0

> **Status:** Draft — Last updated 2026-10-06
> **Author:** The Aristocrat (anonymous)
> **Discussion:** GitHub Issues · Discord

---

## Abstract

The Agent Orchestration Protocol (AOP) defines a universal standard for how AI agents communicate, hand off state, and coordinate across frameworks. Just as HTTP enabled the web to grow beyond any single server implementation, AOP enables a decentralized ecosystem of agents — built with different frameworks, running on different infrastructure, owned by different entities — to interoperate seamlessly.

This specification covers: the message envelope format, state serialization for handoff, capability declaration, and trust anchoring.

---

## 1. Motivation

### 1.1 The Fragmentation Problem

Today's AI agent landscape is fragmented. Each framework — OpenAI Swarm, Microsoft AutoGen, CrewAI, LangGraph, Google ADK — defines its own:

- Message formats (JSON, Python objects, custom state machines)
- State management (in-memory, external stores, framework-specific)
- Handoff semantics (function calls, object passing, YAML configs)
- Capability discovery (manual configuration, no standard)

This means:
- Agents from Framework A cannot hand work to agents from Framework B
- State must be manually reconstructed when moving between frameworks
- There is no "interoperability tax" — but there is a massive "reinvention tax"
- The ecosystem develops in silos, with no universal standard to converge on

### 1.2 The Opportunity

The moment is now because:

1. **It just became possible.** LLMs are fast and cheap enough that multi-agent workflows are practical. Five years ago, the latency and cost made this academic.
2. **No owner exists.** OpenAI won't open-source their coordination layer (it's their moat). Anthropic is still single-agent-focused. No indie has enough gravity to define a standard.
3. **It is becoming infrastructure.** In 500 years, the question won't be "which LLM was best" — it will be "how did distributed intelligence coordinate."

### 1.3 What AOP Is Not

- Not another agent framework — it's the protocol layer beneath all frameworks
- Not a replacement for existing tools — it's the adapter that makes them work together
- Not a company — it's an open specification with a reference implementation

---

## 2. Core Concepts

### 2.1 Message Envelope

Every message between agents follows a universal envelope:

```json
{
  "version": "aop/0.1",
  "message_id": "msg_01hz2j3k4m5n6o7p8q9r0s1t2u",
  "timestamp": "2026-10-06T14:30:00.000Z",
  "sender": {
    "id": "agent_claude_code_1234",
    "framework": "claude-code",
    "protocol_version": "1.0"
  },
  "recipient": {
    "id": "agent_openai_5678",
    "framework": "openai-assistant",
    "protocol_version": "1.0"
  },
  "type": "task.handoff",
  "payload": {
    // Type-specific payload (see Section 3)
  },
  "state": {
    // Serialized state snapshot (see Section 3.2)
  },
  "capabilities": {
    // Declared capabilities (see Section 4)
  },
  "signature": "0x..." // Trust anchor (see Section 5)
}
```

**Field definitions:**
- `version` — Protocol version identifier (`aop/0.1`, `aop/0.2`, etc.)
- `message_id` — Cryptographically unique ID (UUIDv7 or entropy-based)
- `timestamp` — ISO 8601 UTC timestamp
- `sender` / `recipient` — Identity and framework metadata
- `type` — Message type from the registry (Section 3)
- `payload` — Type-specific data
- `state` — Serialized state snapshot for handoff
- `capabilities` — Declared capabilities of the sending agent
- `signature` — Cryptographic signature for trust (Section 5)

### 2.2 State Serialization

For handoffs to work, agents must serialize their internal state in a framework-agnostic format. AOP defines a standard state schema:

```json
{
  "schema_version": "aop-state/0.1",
  "variables": {
    "string_var": "value",
    "number_var": 42,
    "bool_var": true,
    "list_var": [1, 2, 3],
    "nested": {
      "key": "value"
    }
  },
  "files": [
    {
      "path": "relative/path/to/file.txt",
      "content": "base64-encoded content",
      "mime_type": "text/plain"
    }
  ],
  "context": {
    "conversation_history": [],
    "decisions_made": [],
    "constraints": []
  }
}
```

### 2.3 Capability Declaration

Agents declare their capabilities so others know what they can do:

```json
{
  "agent_id": "agent_claude_code_1234",
  "name": "Claude Code Research Assistant",
  "description": "Specializes in codebase analysis and research",
  "capabilities": [
    {
      "name": "read_file",
      "description": "Read files from a codebase",
      "schema": { "type": "object", "properties": { "path": { "type": "string" } } }
    },
    {
      "name": "web_search",
      "description": "Search the web for information",
      "schema": { "type": "object", "properties": { "query": { "type": "string" } } }
    }
  ],
  "trust_score": 0.95,
  "last_active": "2026-10-06T14:30:00.000Z"
}
```

### 2.4 Trust Anchoring

AOP uses Ed25519 signatures for message authenticity. Each agent has a keypair. The public key is registered with a trust anchor (Section 5).

---

## 3. Message Types

### 3.1 Registry

| Type | Purpose |
|------|---------|
| `capability.discover` | Query an agent's capabilities |
| `capability.declare` | Declare capabilities to the network |
| `task.initiate` | Start a new task |
| `task.handoff` | Transfer a task to another agent |
| `task.status` | Query task status |
| `task.result` | Return a task result |
| `task.error` | Report a task error |
| `state.snapshot` | Request or provide a state snapshot |
| `trust.attest` | Trust attestation message |

### 3.2 task.initiate

Starts a new distributed task.

```json
{
  "type": "task.initiate",
  "payload": {
    "task_id": "task_01hz2j3k4m5n6o7p8q9r0s1t2u",
    "intent": "Build a protocol validator for agent handoffs",
    "requirements": {
      "language": "typescript",
      "tests_required": true,
      "deployment_target": "vercel"
    },
    "constraints": {
      "deadline": "2026-10-13T00:00:00.000Z"
    }
  }
}
```

### 3.3 task.handoff

Transfers a task to another agent, including full state.

```json
{
  "type": "task.handoff",
  "payload": {
    "task_id": "task_01hz2j3k4m5n6o7p8q9r0s1t2u",
    "reason": "Needs web research expertise",
    "priority": 8,
    "next_steps": ["search for existing validators", "compare approaches"]
  },
  "state": {
    "schema_version": "aop-state/0.1",
    "variables": {
      "approach_chosen": "schema-based validation",
      "progress_percent": 25
    },
    "context": {
      "decisions_made": ["Chose TypeScript over Rust for speed"],
      "constraints": []
    }
  }
}
```

---

## 4. Agent Identity

Each agent has:
- A **keypair** (Ed25519) for signing messages
- An **agent ID** derived from the keypair
- A **framework declaration** (which framework the agent runs)
- A **capability registry** (what the agent can do)

```typescript
interface AgentIdentity {
  id: string;          // Derived from public key
  publicKey: string;   // Ed25519 public key
  framework: string;   // "claude-code", "openai-assistant", "autogen", etc.
  version: string;     // Framework version
  capabilities: Capability[];
  trustScore: number;  // 0-1, assigned by trust anchors
}
```

---

## 5. Trust Anchors

Trust anchors validate agent identities and capability claims. They are:

1. **Self-attestation** — Agents sign their own capability declarations
2. **Network validation** — Other agents verify signatures
3. **Reputation accumulation** — Success rates improve trust scores

The trust model is **optimistic with evidence** — agents start with self-attested trust scores, which are adjusted based on interaction outcomes.

---

## 6. Reference Implementation

The reference implementation is in TypeScript/Node.js and located in `src/`. It provides:

- `Envelope` — message envelope serialization/deserialization
- `StateSerializer` — state snapshot management
- `CapabilityRegistry` — capability declaration and discovery
- `TrustManager` — signature verification and trust scoring
- `Agent` — base agent class implementing AIO

---

## 7. Benchmark Suite

AOP ships with a benchmark suite that measures:

1. **Handoff latency** — time to transfer state between agents
2. **Cross-framework compatibility** — success rate of handoffs across frameworks
3. **State fidelity** — how accurately state is reconstructed after handoff
4. **Trust verification speed** — signature verification throughput

---

## 8. Future Extensions

- **Agent discovery protocol** — gossip-based agent discovery on local networks
- **Encrypted state transfer** — end-to-end encryption for sensitive state
- **Multi-agent consensus** — protocols for groups of agents reaching consensus
- **Agent persistence** — checkpointing agents to disk for later resumption

---

## 9. IANA Considerations

This document requests registration of the following media types:
- `application/aop+message` — for AOP message envelopes
- `application/aop+state` — for AOP state snapshots

---

## 10. Security Considerations

- Signatures must be verified on every message
- State snapshots may contain sensitive data — encryption is optional but recommended
- Trust scores can be gamed — monitor for anomalous patterns
- Agent IDs should be derived from keypairs, never assigned centrally

---

## 11. References

- [RFC 4122](https://datatracker.ietf.org/doc/html/rfc4122) — UUID URN namespace
- [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032) — Ed25519 digital signature
- OpenAI Swarm documentation — inspiration for function-based handoff
- Microsoft AutoGen — inspiration for state management patterns
