import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateKey,
  emptyData,
  readData,
  saveEntry,
  completeEntry,
  entriesInSlot,
  timeLabel,
  currentSlot,
  rememberActivity,
  type Entry,
} from "./model";
import { weekDates, shiftWeek, to24Hour } from "./date-time";
import { activities, filterActivities } from "./activities";
const entry = (id: string, changes: Partial<Entry> = {}): Entry => ({
  id,
  date: "2026-09-28",
  startMinute: 570,
  name: "Walking",
  icon: "walk",
  status: "done",
  ...changes,
});

test("migrates v1 hourly entries and preserves enjoyment and hidden daily ratings", () => {
  const data = readData(
    JSON.stringify({
      version: 1,
      name: "John",
      entries: {
        "2026-09-28/9": {
          date: "2026-09-28",
          hour: 9,
          name: "Walk",
          icon: "walk",
          status: "done",
          rating: 8,
        },
      },
      ratings: { "2026-09-28": 6 },
    }),
  );
  assert.equal(data.version, 2);
  assert.equal(data.name, "John");
  const migrated = Object.values(data.entries)[0];
  assert.equal(migrated.startMinute, 540);
  assert.equal(migrated.rating, 8);
  assert.equal(migrated.mood, undefined);
  assert.equal(data.ratings["2026-09-28"], 6);
  assert.deepEqual(readData(JSON.stringify(data)), data);
});
test("multiple entries share a half-hour; moving or deleting one preserves siblings", () => {
  let data = saveEntry(
    saveEntry(emptyData(), entry("a")),
    entry("b", { name: "Reading", mood: 2, rating: 9 }),
  );
  assert.equal(entriesInSlot(data, "2026-09-28", 570).length, 2);
  data = saveEntry(data, entry("a", { startMinute: 600 }));
  assert.equal(entriesInSlot(data, "2026-09-28", 570).length, 1);
  assert.equal(data.entries.b.mood, 2);
  assert.equal(data.entries.b.rating, 9);
  const entries = { ...data.entries };
  delete entries.a;
  assert.equal(entries.b.name, "Reading");
});
test("completing keeps identity and independent mood/enjoyment values", () => {
  const data = completeEntry(
    saveEntry(
      emptyData(),
      entry("x", { status: "planned", mood: 3, rating: 8 }),
    ),
    "x",
  );
  assert.equal(data.entries.x.status, "done");
  assert.equal(data.entries.x.mood, 3);
  assert.equal(data.entries.x.rating, 8);
  assert.deepEqual(readData(JSON.stringify(data)), data);
});
test("half-hour labels and local date boundaries", () => {
  assert.equal(timeLabel(0), "12:00 AM");
  assert.equal(timeLabel(30), "12:30 AM");
  assert.equal(timeLabel(720), "12:00 PM");
  assert.equal(timeLabel(1410), "11:30 PM");
  assert.equal(currentSlot(new Date(2026, 8, 28, 23, 59)), 1410);
  assert.equal(currentSlot(new Date(2026, 8, 28, 9, 29)), 540);
  assert.equal(dateKey(new Date(2026, 8, 28, 23, 59)), "2026-09-28");
});
test("malformed storage recovers and invalid slots cannot enter the calendar", () => {
  assert.deepEqual(readData("broken"), emptyData());
  const data = emptyData();
  data.entries.x = entry("x", { startMinute: 1440 });
  data.entries.y = entry("y", { date: "2026-02-31" });
  data.entries.z = entry("z", { startMinute: 15 });
  assert.equal(Object.keys(readData(JSON.stringify(data)).entries).length, 0);
});
test("recents are persisted, deduplicated and limited without changing activities", () => {
  let data = emptyData();
  for (let i = 0; i < 12; i++)
    data = rememberActivity(data, { name: `Activity ${i}`, icon: "custom" });
  data = rememberActivity(data, { name: "Activity 8", icon: "read" });
  assert.equal(data.recentActivities.length, 8);
  assert.equal(data.recentActivities[0].name, "Activity 8");
  assert.equal(
    data.recentActivities.filter((a) => a.name === "Activity 8").length,
    1,
  );
  assert.deepEqual(readData(JSON.stringify(data)), data);
});
test("catalog has at least 100 unique activities and filters partial words case-insensitively", () => {
  assert.ok(activities.length >= 100);
  assert.equal(new Set(activities.map((a) => a.name)).size, activities.length);
  assert.ok(filterActivities("READ").some((a) => a.name === "Reading"));
  assert.ok(
    filterActivities("walk dog").some((a) => a.name === "Walking the dog"),
  );
  assert.equal(filterActivities("zzznotfound").length, 0);
});
test("calendar weeks cross years and 12-hour conversion handles noon and midnight", () => {
  assert.deepEqual(weekDates("2027-01-01").map(dateKey), [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ]);
  assert.equal(shiftWeek("2026-12-28", 1), "2027-01-04");
  assert.equal(shiftWeek("2027-01-04", -1), "2026-12-28");
  assert.equal(to24Hour(12, "AM"), 0);
  assert.equal(to24Hour(12, "PM"), 12);
});
