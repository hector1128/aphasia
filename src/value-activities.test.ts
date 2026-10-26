import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyData, type Entry } from "./model";
import { valueActivitiesOnDay } from "./Values";

test("value linking filters by day before removing repeated activity names and excludes sleep", () => {
  const entry = (id: string, date: string, name: string, startMinute: number, extra: Partial<Entry> = {}): Entry =>
    ({ id, date, name, startMinute, icon: "custom", source: "logged", status: "done", ...extra });
  const entries = [
    entry("yesterday", "2026-10-24", "Reading", 480),
    entry("late", "2026-10-25", "Reading", 700),
    entry("early", "2026-10-25", "reading", 500, { source: "scheduled", status: "planned" }),
    entry("walk", "2026-10-25", "Walking", 600),
    entry("sleep", "2026-10-25", "Sleeping", 400, { sleepId: "sleep-record" }),
    entry("wake", "2026-10-25", "Wake up", 450, { sleepBoundary: "wake" }),
    entry("next-week", "2026-10-26", "Cooking", 700),
  ];
  const data = { ...emptyData(), entries: Object.fromEntries(entries.map((item) => [item.id, item])) };
  assert.deepEqual(valueActivitiesOnDay(data, "2026-10-25").map((item) => item.id), ["early", "walk"]);
  assert.deepEqual(valueActivitiesOnDay(data, "2026-10-24").map((item) => item.id), ["yesterday"]);
  assert.deepEqual(valueActivitiesOnDay(data, "2026-10-23"), []);
  assert.equal(data.entries.late.startMinute, 700);
});
