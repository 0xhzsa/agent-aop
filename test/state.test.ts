// Tests for AOP state serialization and management
// Uses Node's built-in test runner with strict assertions

import { strict as assert } from "assert";

import {
  createStateSnapshot,
  getVariable,
  setVariable,
  mergeState,
  getFileContent,
  addFile,
  serializeState,
  deserializeState,
  diffState,
} from "../src/state.js";
import { STATE_SCHEMA_VERSION } from "../src/types.js";

function testState(): void {
  console.log("🧪 Testing state operations...\n");

  // Test 1: Create a state snapshot
  const snapshot = createStateSnapshot({
    task: { status: "pending" },
    progress: 0,
  });
  assert.strictEqual(snapshot.schemaVersion, STATE_SCHEMA_VERSION);
  assert.deepStrictEqual(snapshot.variables.task, { status: "pending" });
  assert.strictEqual(snapshot.variables.progress, 0);
  assert.deepStrictEqual(snapshot.files, []);
  assert.deepStrictEqual(snapshot.context.conversationHistory, []);
  console.log("  ✅ createStateSnapshot — snapshot created correctly");

  // Test 2: Serialize and deserialize
  const snap2 = createStateSnapshot({
    task: { id: "t1", status: "running" },
    findings: ["finding1", "finding2"],
  });
  const json = serializeState(snap2);
  const restored = deserializeState(json);
  assert.ok(restored !== null);
  assert.deepStrictEqual(restored!.variables.task, { id: "t1", status: "running" });
  assert.deepStrictEqual(restored!.variables.findings, ["finding1", "finding2"]);
  console.log("  ✅ serialize/deserialize — round-trip successful");

  // Test 3: Get and set nested variables
  const snap3 = createStateSnapshot({
    user: { name: "Alice", profile: { age: 30 } },
  });
  assert.strictEqual(getVariable(snap3, "user.name"), "Alice");
  assert.strictEqual(getVariable(snap3, "user.profile.age"), 30);
  setVariable(snap3, "user.profile.age", 31);
  assert.strictEqual(getVariable(snap3, "user.profile.age"), 31);
  console.log("  ✅ getVariable/setVariable — nested access works");

  // Test 4: Handle missing paths
  const snap4 = createStateSnapshot({ foo: "bar" });
  assert.strictEqual(getVariable(snap4, "foo.bar.baz"), undefined);
  assert.strictEqual(getVariable(snap4, "missing.path"), undefined);
  console.log("  ✅ getVariable — missing paths return undefined");

  // Test 5: Merge state snapshots
  const base = createStateSnapshot({ a: 1, b: 2, nested: { x: 1 } });
  const incoming = createStateSnapshot({ b: 3, c: 4, nested: { y: 2 } });
  const merged = mergeState(base, incoming);
  assert.strictEqual(merged.variables.a, 1);
  assert.strictEqual(merged.variables.b, 3);
  assert.strictEqual(merged.variables.c, 4);
  assert.strictEqual((merged.variables.nested as any).x, 1);
  assert.strictEqual((merged.variables.nested as any).y, 2);
  console.log("  ✅ mergeState — snapshots merged correctly");

  // Test 6: Files in state
  const snap5 = createStateSnapshot(
    { data: "test" },
    { files: [{ path: "test.txt", content: "hello world", mimeType: "text/plain" }] }
  );
  assert.strictEqual(snap5.files.length, 1);
  assert.strictEqual(getFileContent(snap5, "test.txt"), "hello world");
  addFile(snap5, { path: "test2.txt", content: "goodbye", mimeType: "text/plain" });
  assert.strictEqual(snap5.files.length, 2);
  assert.strictEqual(getFileContent(snap5, "test2.txt"), "goodbye");
  console.log("  ✅ files — file storage and retrieval works");

  // Test 7: Diff state snapshots
  const before = createStateSnapshot({ a: 1, b: 2, c: 3 });
  const after = createStateSnapshot({ a: 1, b: 5, d: 4 });
  const diff = diffState(before, after);
  assert.deepStrictEqual(diff.added, ["d"]);
  assert.deepStrictEqual(diff.removed, ["c"]);
  assert.deepStrictEqual(diff.changed, ["b"]);
  console.log("  ✅ diffState — state differences detected correctly");

  console.log("\n✅ All state tests passed!\n");
}

// Run tests
testState();
console.log("🎉 All state tests passed!");
