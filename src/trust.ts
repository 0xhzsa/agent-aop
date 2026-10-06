// Trust management — Ed25519 signatures and verification

import { AgentId, CapabilityRegistry, Envelope } from "./types.js";
import { canonicalizeEnvelope } from "./envelope.js";

// For the reference implementation, we use Node.js crypto.
// In production, this would support pluggable signature backends.
import * as crypto from "crypto";

/**
 * Generate a new Ed25519 key pair for an agent
 */
export function generateKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return { publicKey, privateKey };
}

/**
 * Sign a message with an Ed25519 private key
 */
export function signMessage(
  message: string,
  privateKeyPem: string
): string {
  const keyObject = crypto.createPrivateKey(privateKeyPem);
  return crypto.sign(null, Buffer.from(message, "utf-8"), keyObject).toString("base64url");
}

/**
 * Verify a message signature
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    const keyObject = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(
      null,
      Buffer.from(message, "utf-8"),
      keyObject,
      Buffer.from(signature, "base64url")
    );
  } catch {
    return false;
  }
}

/**
 * Sign an envelope (the canonical form, excluding the signature field)
 */
export function signEnvelope(
  envelope: Omit<Envelope, "signature">,
  privateKeyPem: string
): string {
  const canonical = canonicalizeEnvelope(envelope);
  return signMessage(canonical, privateKeyPem);
}

/**
 * Verify an envelope's signature
 */
export function verifyEnvelope(
  envelope: Envelope,
  publicKeyPem: string
): boolean {
  const { signature, ...envelopeNoSig } = envelope;
  const canonical = canonicalizeEnvelope(envelopeNoSig);
  return verifySignature(canonical, signature, publicKeyPem);
}

/**
 * Sign a capability registry
 */
export function signCapabilityRegistry(
  registry: Omit<CapabilityRegistry, "signature">,
  privateKeyPem: string
): string {
  const canonical = JSON.stringify(registry, Object.keys(registry).sort());
  return signMessage(canonical, privateKeyPem);
}

/**
 * Verify a capability registry's signature
 */
export function verifyCapabilityRegistry(
  registry: CapabilityRegistry,
  publicKeyPem: string
): boolean {
  const { signature, ...registryNoSig } = registry;
  const canonical = JSON.stringify(registryNoSig, Object.keys(registryNoSig).sort());
  return verifySignature(canonical, signature, publicKeyPem);
}

/**
 * Trust score update based on interaction outcomes
 */
type InteractionOutcome = "success" | "failure" | "timeout" | "rejected";

interface TrustUpdate {
  agentId: AgentId;
  outcome: InteractionOutcome;
  previousScore: number;
  newScore: number;
  timestamp: string;
}

const TRUST_ALPHA = 0.15; // Learning rate for trust updates

/**
 * Update an agent's trust score based on interaction outcome
 */
export function updateTrustScore(
  agentId: AgentId,
  currentScore: number,
  outcome: InteractionOutcome
): TrustUpdate {
  let delta = 0;

  switch (outcome) {
    case "success":
      delta = TRUST_ALPHA * (1 - currentScore);
      break;
    case "failure":
      delta = -TRUST_ALPHA * currentScore;
      break;
    case "timeout":
      delta = -TRUST_ALPHA * 0.5 * currentScore;
      break;
    case "rejected":
      delta = -TRUST_ALPHA * 0.8 * currentScore;
      break;
  }

  const newScore = Math.max(0, Math.min(1, currentScore + delta));

  return {
    agentId,
    outcome,
    previousScore: currentScore,
    newScore,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Trust anchor — validates agent identities
 */
export class TrustAnchor {
  private knownKeys: Map<AgentId, string> = new Map();

  /** Register a trusted agent by ID and public key */
  registerAgent(agentId: AgentId, publicKeyPem: string): void {
    this.knownKeys.set(agentId, publicKeyPem);
  }

  /** Get a trusted agent's public key */
  getPublicKey(agentId: AgentId): string | null {
    return this.knownKeys.get(agentId) || null;
  }

  /** Check if an agent is registered */
  isRegistered(agentId: AgentId): boolean {
    return this.knownKeys.has(agentId);
  }

  /** Verify an envelope against registered keys */
  verifyEnvelope(envelope: Envelope): boolean {
    const publicKey = this.knownKeys.get(envelope.sender.id);
    if (!publicKey) return false;
    return verifyEnvelope(envelope, publicKey);
  }
}
