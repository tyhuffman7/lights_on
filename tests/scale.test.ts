import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStage } from "../worker/scale.ts";
test("Scripted load persists every parsed update and emits processing/queue measurements", async () => {
  const stage = await loadStage(10, 100, 350);
  assert.ok(stage.updates > 10);
  assert.equal(stage.bookRecords, stage.updates + 20);
  assert.equal(stage.persistenceDrained, true);
  assert.ok(stage.measurements.latencyMs.processing.count > 0);
  assert.ok(stage.measurements.latencyMs.persistenceWrite.count > 0);
});
