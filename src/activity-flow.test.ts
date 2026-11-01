import assert from "node:assert/strict";
import { test } from "node:test";
import { activitySteps } from "./activity-flow";

test("selected calendar slots keep the day but now ask for time and logged duration", () => {
  const slot = { planning: false, completing: false, chooseDay: false, sleep: false };
  assert.deepEqual(activitySteps(slot), ["activity", "time", "mood", "enjoyment", "importance", "duration"]);
  assert.deepEqual(activitySteps({ ...slot, planning: true }), ["activity", "value", "time"]);
  assert.deepEqual(activitySteps({ ...slot, planning: true, chooseDay: true }), ["activity", "value", "day", "time"]);
  assert.deepEqual(activitySteps({ ...slot, sleep: true }), ["activity", "time"]);
  assert.deepEqual(activitySteps({ ...slot, completing: true }), ["mood", "enjoyment", "importance", "duration"]);
  assert.deepEqual(activitySteps({ ...slot, completing: true, sleep: true }), ["mood", "enjoyment", "importance"]);
});
test("cached importance removes only importance, keeping the final duration step", () => {
  const options = { planning: false, completing: false, sleep: false, importanceCached: true };
  assert.deepEqual(activitySteps(options), ["activity", "time", "mood", "enjoyment", "duration"]);
  assert.deepEqual(activitySteps({ ...options, completing: true }), ["mood", "enjoyment", "duration"]);
  assert.deepEqual(activitySteps({ ...options, sleep: true }), ["activity", "time"]);
});
test("scheduling from a value does not ask for the value again", () => {
  assert.deepEqual(activitySteps({ planning: true, completing: false, chooseDay: true, sleep: false, valueLinked: true }), ["activity", "day", "time"]);
});
