import assert from "node:assert/strict";
import { test } from "node:test";
import { activitySteps } from "./activity-flow";

test("logging keeps the selected day and time, scheduling chooses a time range", () => {
  const slot = { planning: false, completing: false, chooseDay: false, sleep: false };
  assert.deepEqual(activitySteps(slot), ["activity", "mood", "enjoyment", "importance", "duration"]);
  assert.deepEqual(activitySteps({ ...slot, planning: true }), ["activity", "value", "time"]);
  assert.deepEqual(activitySteps({ ...slot, planning: true, chooseDay: true }), ["activity", "value", "day", "time"]);
  assert.deepEqual(activitySteps({ ...slot, sleep: true }), ["activity"]);
  assert.deepEqual(activitySteps({ ...slot, completing: true }), ["mood", "enjoyment", "importance", "duration"]);
  assert.deepEqual(activitySteps({ ...slot, completing: true, sleep: true }), ["mood", "enjoyment", "importance"]);
});
test("cached importance removes only importance, keeping the final duration step", () => {
  const options = { planning: false, completing: false, sleep: false, importanceCached: true };
  assert.deepEqual(activitySteps(options), ["activity", "mood", "enjoyment", "duration"]);
  assert.deepEqual(activitySteps({ ...options, completing: true }), ["mood", "enjoyment", "duration"]);
  assert.deepEqual(activitySteps({ ...options, sleep: true }), ["activity"]);
});
test("scheduling a linked activity starts at the day step", () => {
  assert.deepEqual(activitySteps({ planning: true, completing: false, chooseDay: true, sleep: false, valueLinked: true }), ["day", "time"]);
});
