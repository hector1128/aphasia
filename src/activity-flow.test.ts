import assert from "node:assert/strict";
import { test } from "node:test";
import { activitySteps } from "./activity-flow";

test("selected slots skip date/time while standalone scheduling retains them", () => {
  const slot = { planning: false, completing: false, chooseTime: false, sleep: false };
  assert.deepEqual(activitySteps(slot), ["activity", "mood", "enjoyment", "importance"]);
  assert.deepEqual(activitySteps({ ...slot, planning: true }), ["activity", "value"]);
  assert.deepEqual(activitySteps({ ...slot, planning: true, chooseTime: true }), ["activity", "value", "day", "time"]);
  assert.deepEqual(activitySteps({ ...slot, sleep: true }), ["activity"]);
  assert.deepEqual(activitySteps({ ...slot, completing: true }), ["mood", "enjoyment", "importance"]);
});

test("cached importance removes only importance from logging and completion", () => {
  const options = { planning: false, completing: false, chooseTime: false, sleep: false, importanceCached: true };
  assert.deepEqual(activitySteps(options), ["activity", "mood", "enjoyment"]);
  assert.deepEqual(activitySteps({ ...options, completing: true }), ["mood", "enjoyment"]);
  assert.deepEqual(activitySteps({ ...options, sleep: true }), ["activity"]);
  assert.deepEqual(activitySteps({ ...options, planning: true }), ["activity", "value"]);
});

test("scheduling from a value keeps activity and time selection without asking for a value again", () => {
  assert.deepEqual(activitySteps({ planning: true, completing: false, chooseTime: true, sleep: false, valueLinked: true }),
    ["activity", "day", "time"]);
});
