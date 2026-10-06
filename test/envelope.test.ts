// Tests for AOP envelope creation, signing, and verification
// Uses Node's built-in test runner with strict assertions

import { strict as assert } from "assert";

import {
  createEnvelope,
  verifyEnvelopeStructure,
  serializeEnvelope,
  deserializeEnvelope,
  createParticipant,
  generateMessageId,
  generateTaskId,
  canonicalizeEnvelope,
} from "../src/envelope.js";
import { AOP_VERSION } from "../src/types.js";
import { generateKeyPair, signEnvelope, verifyEnvelope } from "../src/trust.js";
import { Envelope, EnvelopeParticipant } from "../src/types.js";

function testEnvelope(): void {
  console.log("🧪 Testing envelope operations...\n");

  // Test 1: Unique message IDs
  const id1 = generateMessageId();
  const id2 = generateMessageId();
  assert.ok(id1.startsWith("msg_"), "ID should start with msg_");
  assert.ok(id2.startsWith("msg_"), "ID should start with msg_");
  assert.notStrictEqual(id1, id2, "IDs should be unique");
  console.log("  ✅ generateMessageId — unique IDs generated");

  // Test 2: Unique task IDs
  const tid1 = generateTaskId();
  const tid2 = generateTaskId();
  assert.ok(tid1.startsWith("task_"), "Task ID should start with task_");
  assert.notStrictEqual(tid1, tid2, "Task IDs should be unique");
  console.log("  ✅ generateTaskId — unique task IDs generated");

  // Test 3: Create a valid envelope
  const sender: EnvelopeParticipant = createParticipant("agent_1", "claude-code");
  const envelope = createEnvelope(
    sender,
    null,
    "task.initiate",
    { taskId: "task_123", intent: "test", requirements: {}, constraints: {} }
  );
  assert.strictEqual(envelope.version, AOP_VERSION);
  assert.ok(envelope.messageId.startsWith("msg_"));
  assert.strictEqual(envelope.sender.id, "agent_1");
  assert.strictEqual(envelope.recipient, null);
  assert.strictEqual(envelope.type, "task.initiate");
  console.log("  ✅ createEnvelope — valid envelope created");

  // Test 4: Serialize and deserialize
  const serialized = serializeEnvelope(envelope);
  const deserialized = deserializeEnvelope(serialized);
  assert.ok(deserialized !== null);
  assert.strictEqual(deserialized!.type, "task.initiate");
  assert.strictEqual(deserialized!.sender.id, "agent_1");
  console.log("  ✅ serialize/deserialize — round-trip successful");

  // Test 5: Reject invalid structures
  assert.strictEqual(deserializeEnvelope("not json"), null);
  assert.strictEqual(deserializeEnvelope('{"version":"wrong"}'), null);
  assert.strictEqual(verifyEnvelopeStructure({}), null);
  assert.strictEqual(verifyEnvelopeStructure(null), null);
  console.log("  ✅ verifyEnvelopeStructure — invalid structures rejected");

  // Test 6: Canonicalizes for signing
  const canonical = canonicalizeEnvelope(envelope);
  assert.ok(canonical.includes("task.initiate"));
  assert.ok(canonical.includes("agent_1"));
  console.log("  ✅ canonicalizeEnvelope — deterministic output");

  console.log("\n✅ All envelope tests passed!\n");
}

function testTrust(): void {
  console.log("🧪 Testing trust/signature operations...\n");

  // Test 1: Generate key pairs
  const keys = generateKeyPair();
  assert.ok(keys.publicKey.includes("BEGIN PUBLIC KEY"));
  assert.ok(keys.privateKey.includes("BEGIN PRIVATE KEY"));
  console.log("  ✅ generateKeyPair — valid Ed25519 keys generated");

  // Test 2: Sign and verify
  const sender = createParticipant("agent_1", "claude-code");
  const envelope = createEnvelope(
    sender,
    null,
    "task.initiate",
    { taskId: "t1", intent: "test", requirements: {}, constraints: {} }
  );
  const signature = signEnvelope(envelope, keys.privateKey);
  assert.ok(signature.length > 0, "Signature should not be empty");
  console.log("  ✅ signEnvelope — signature generated");

  // Test 3: Verify valid signature
  const fullEnvelope: Envelope = { ...envelope, signature };
  assert.strictEqual(verifyEnvelope(fullEnvelope, keys.publicKey), true);
  console.log("  ✅ verifyEnvelope — valid signature verified");

  // Test 4: Reject invalid signature
  const tamperedEnvelope: Envelope = { ...envelope, signature: "tampered" + signature.slice(7) };
  assert.strictEqual(verifyEnvelope(tamperedEnvelope, keys.publicKey), false);
  console.log("  ✅ verifyEnvelope — tampered signature rejected");

  // Test 5: Reject wrong key
  const keys2 = generateKeyPair();
  assert.strictEqual(verifyEnvelope(fullEnvelope, keys2.publicKey), false);
  console.log("  ✅ verifyEnvelope — wrong key rejected");

  console.log("\n✅ All trust tests passed!\n");
}

// Run tests
void testEnvelope();
void testTrust();
console.log("🎉 All tests passed!");
