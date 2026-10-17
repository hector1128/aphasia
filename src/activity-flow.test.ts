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
