import assert from "node:assert/strict";
import { test } from "node:test";
import { recommendedActivities } from "./recommended";
import type { Entry } from "../model";

const now = new Date("2026-11-09T18:00:00");
const entry = (id: string, name: string, changes: Partial<Entry> = {}): Entry => ({
  id, name, icon: "custom", date: "2026-11-03", startMinute: 600, status: "done", source: "logged", ...changes,
});

test("recommendations prefer matching weekday and half-hour, then frequency, without repeating aliases", () => {
  const records = [
    entry("1", "Reading", { startMinute: 610 }),
    entry("2", "Read", { date: "2026-10-27" }),
    entry("3", "Gardening"),
    entry("4", "Walking", { date: "2026-11-04" }),
    entry("5", "Walking", { date: "2026-11-05" }),
    entry("6", "Painting", { startMinute: 630 }),
    entry("7", "Working", { date: "2026-11-10" }),
    entry("8", "Swimming", { status: "planned" }),
    entry("9", "Running", { status: "missed" }),
    entry("10", "Sleep", { sleepId: "overnight" }),
    entry("11", "Wake up", { sleepBoundary: "wake" }),
  ];
  const data = { entries: Object.fromEntries(records.map((record) => [record.id, record])) };
  assert.deepEqual(recommendedActivities(data, { date: "2026-11-10", startMinute: 600 }, now).map((a) => a.name), ["Reading", "Gardening", "Walking"]);
  assert.equal(recommendedActivities(data, { date: "2026-11-11", startMinute: 600 }, now)[0].name, "Walking");
  assert.equal(recommendedActivities(data, { date: "2026-11-10", startMinute: 630 }, now)[0].name, "Painting");
});

test("recommendations without matching history use the selected time of day and weekday", () => {
  const data = { entries: {} };
  assert.equal(recommendedActivities(data, { date: "2026-11-10", startMinute: 480 }, now)[0].name, "Breakfast");
  assert.equal(recommendedActivities(data, { date: "2026-11-10", startMinute: 1080 }, now)[0].name, "Dinner");
  assert.ok(recommendedActivities(data, { date: "2026-11-10", startMinute: 600 }, now).some((a) => a.name === "Working"));
  assert.ok(recommendedActivities(data, { date: "2026-11-14", startMinute: 600 }, now).some((a) => a.name === "Gardening"));
});
