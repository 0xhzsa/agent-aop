// Message envelope creation, serialization, and verification

import {
  Envelope,
  EnvelopeParticipant,
  MessageId,
  AOP_VERSION,
  MessageType,
} from "./types.js";

/**
 * Generate a unique message ID (UUIDv7-style, entropy-based)
 */
export function generateMessageId(): MessageId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 12);
  return `msg_${timestamp}_${random}`;
}

/**
 * Generate a task ID
 */
export function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 12);
  return `task_${timestamp}_${random}`;
}

/**
 * Create the canonical JSON string for signing/verification.
 * Deep-sorts all keys for deterministic output.
 */
export function canonicalizeEnvelope(
  envelope: Omit<Envelope, "signature">
): string {
  // Deep sort keys recursively for deterministic output
  return JSON.stringify(deepSortKeys(envelope));
}

/**
 * Recursively sort object keys for deterministic serialization
 */
function deepSortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys);
  }
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

/**
 * Create a new AOP envelope
 */
export function createEnvelope<T extends MessageType>(
  sender: EnvelopeParticipant,
  recipient: EnvelopeParticipant | null,
  type: T,
  payload: Record<string, unknown>,
  options?: {
    state?: any;
    capabilities?: any;
    timestamp?: string;
    messageId?: string;
  }
): Omit<Envelope<T>, "signature"> {
  return {
    version: AOP_VERSION,
    messageId: options?.messageId || generateMessageId(),
    timestamp: options?.timestamp || new Date().toISOString(),
    sender,
    recipient,
    type,
    payload,
    ...(options?.state ? { state: options.state } : {}),
    ...(options?.capabilities ? { capabilities: options.capabilities } : {}),
  };
}

/**
 * Verify envelope structure
 */
export function verifyEnvelopeStructure(envelope: unknown): Envelope | null {
  if (typeof envelope !== "object" || envelope === null) return null;
  const e = envelope as Record<string, unknown>;

  // Check required fields (state and signature are optional on envelopes)
  const requiredFields = ["version", "messageId", "timestamp", "sender", "type", "payload"];
  for (const field of requiredFields) {
    if (!(field in e)) return null;
  }

  // Check version
  if (e.version !== AOP_VERSION) return null;

  // Check type is known
  const validTypes: MessageType[] = [
    "capability.discover",
    "capability.declare",
    "task.initiate",
    "task.handoff",
    "task.status",
    "task.result",
    "task.error",
    "state.snapshot",
    "trust.attest",
  ];
  if (!validTypes.includes(e.type as MessageType)) return null;

  return e as unknown as Envelope;
}

/**
 * Serialize an envelope to JSON string
 */
export function serializeEnvelope(envelope: Envelope | Omit<Envelope, "signature">): string {
  return JSON.stringify(envelope);
}

/**
 * Deserialize an envelope from JSON string
 */
export function deserializeEnvelope(json: string): Envelope | null {
  try {
    const parsed = JSON.parse(json);
    return verifyEnvelopeStructure(parsed) as unknown as Envelope | null;
  } catch {
    return null;
  }
}

/**
 * Create a sender participant identity
 */
export function createParticipant(
  id: string,
  framework: EnvelopeParticipant["framework"],
  endpoint?: EnvelopeParticipant["endpoint"]
): EnvelopeParticipant {
  return {
    id,
    framework,
    protocolVersion: "1.0",
    ...(endpoint ? { endpoint } : {}),
  };
}

/**
 * Encode payload to base64 string (for state file content)
 */
export function encodeBase64(content: string | Buffer): string {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8");
  return buffer.toString("base64");
}

/**
 * Decode base64 string to UTF-8
 */
export function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf-8");
}
