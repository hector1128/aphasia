import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type Entry, emptyData, entriesInSlot, entriesOnDate, readData, saveActivity, saveEntry, repeatActivity, findEntry, removeEntry, stopRepeating, resizeActivity, setScheduledStatus, dateKey } from "./model";
import { personalActivity, customShapes } from "./personal-activities";
import { searchActivities } from "./activity-catalogue";
import { weeklyStats, weeklyReportData } from "./weekly";
import { reportSections } from "./report-data";
import { ActivityPicker } from "./ActivityPicker";
import { ActivityIcon } from "./ActivityIcon";
const activity = (changes: Partial<Entry> = {}): Entry => ({ id: "one", name: "Reading", icon: "read", date: "2026-11-01", startMinute: 600, durationMinutes: 90, source: "scheduled", status: "planned", ...changes });

test("duration fills every occupied half hour without duplicating the activity or its ratings", () => {
  const data = saveEntry(emptyData(), activity({ source: "logged", status: "done", mood: 7 }));
  for (const minute of [600, 630, 660]) assert.equal(entriesInSlot(data, "2026-11-01", minute)[0]?.id, "one");
  for (const minute of [570, 690]) assert.equal(entriesInSlot(data, "2026-11-01", minute).length, 0);
  assert.equal(weeklyStats(data, "2026-11-01").totalActivities, 1);
  assert.ok(JSON.stringify(reportSections(data, "2026-11-01")).includes('45 (not completed)'));
  assert.deepEqual(readData(JSON.stringify(data)), data);
});
test("daily, weekday and weekly repeats are derived by calendar date across DST and survive reload", () => {
  const initial = activity({ date: "2026-10-31", startMinute: 480, durationMinutes: 30 });
  const data = readData(JSON.stringify(repeatActivity(emptyData(), initial, "daily")));
  assert.equal(entriesOnDate(data, "2026-11-01")[0]?.startMinute, 480);
  assert.equal(entriesOnDate(data, "2026-11-02")[0]?.startMinute, 480);
  assert.equal(Object.keys(data.entries).length, 1);
  const week = repeatActivity(emptyData(), initial, "weekly");
  assert.equal(entriesOnDate(week, "2026-11-01").length, 0);
  assert.equal(entriesOnDate(week, "2026-11-07").length, 1);
  const weekdays = repeatActivity(emptyData(), activity({ date: "2026-11-02" }), "weekdays");
  assert.equal(entriesOnDate(weekdays, "2026-11-06").length, 1);
  assert.equal(entriesOnDate(weekdays, "2026-11-07").length, 0);
  assert.equal(entriesOnDate(weekdays, "2026-11-09").length, 1);
});
test("completing, editing, deleting and stopping repeat occurrences never changes other dates", () => {
  let data = repeatActivity(emptyData(), activity(), "daily");
  const id = "one@2026-11-02";
  assert.equal(findEntry(data, id)?.status, "planned");
  data = setScheduledStatus(data, id, "done", new Date("2026-11-02T14:00"));
  assert.equal(entriesOnDate(data, "2026-11-02")[0]?.status, "done");
  data = saveActivity(data, { ...entriesOnDate(data, "2026-11-02")[0], durationMinutes: 120, mood: 9 });
  assert.equal(entriesOnDate(data, "2026-11-03")[0]?.durationMinutes, 90);
  assert.equal(entriesOnDate(data, "2026-11-03")[0]?.mood, undefined);
  data = removeEntry(data, "one@2026-11-03");
  assert.equal(entriesOnDate(readData(JSON.stringify(data)), "2026-11-03").length, 0);
  assert.equal(entriesOnDate(data, "2026-11-04").length, 1);
  data = stopRepeating(data, "one", "2026-11-04");
  assert.equal(entriesOnDate(data, "2026-11-04").length, 0);
  assert.equal(entriesOnDate(data, "2026-11-02")[0]?.mood, 9);
  const snapshot = weeklyReportData(data, "2026-11-02");
  assert.equal(snapshot.recurringActivities.length, 0);
  assert.equal(weeklyStats(snapshot, "2026-11-02", new Date("2026-11-05")).totalActivities, 1);
});
test("duration resizing stays in the day and has a minimum of one block", () => {
  const entry = activity();
  assert.equal(resizeActivity(entry, "end", 750).durationMinutes, 150);
  assert.equal(resizeActivity(entry, "end", 540).durationMinutes, 30);
  assert.equal(resizeActivity(entry, "end", 1500).durationMinutes, 840);
  assert.deepEqual([resizeActivity(entry, "start", 570).startMinute, resizeActivity(entry, "start", 570).durationMinutes], [570, 120]);
  assert.equal(resizeActivity(activity({ startMinute: 995, durationMinutes: undefined }), "end", 1050).durationMinutes, 60);
});
test("personal custom choices rotate six shapes, retain their icon and appear first in the category list", () => {
  let data = emptyData();
  for (let i = 0; i < 7; i++) data = saveEntry(data, activity({ id: String(i), name: `Unique custom pastime ${i}`, icon: "custom" }));
  assert.deepEqual(data.myActivities.map((item) => item.icon), [...customShapes, customShapes[0]]);
  assert.equal(personalActivity(data.myActivities, { name: "Unique custom pastime 2", icon: "custom" }).icon, customShapes[2]);
  const restored = readData(JSON.stringify(data));
  assert.deepEqual(restored.myActivities, data.myActivities);
  for (const choice of restored.myActivities) assert.doesNotMatch(renderToStaticMarkup(createElement(ActivityIcon, { id: choice.icon, name: choice.name })), /lucide-activity|heart-pulse/);
  const html = renderToStaticMarkup(createElement(ActivityPicker, { value: { name: "", icon: "custom" }, mine: data.myActivities, recent: [], onChange: () => {} }));
  assert.ok(html.indexOf('My activities') < html.indexOf('Food and drinks'));
  assert.equal(dateKey(new Date('2026-11-01T12:00')), '2026-11-01');
});
test("search tolerates missing and transposed letters without losing personal names", () => {
  for (const query of ["brekfast", "eating breakfst", "brekafast"]) assert.equal(searchActivities(query)[0]?.name, "Breakfast", query);
  assert.ok(searchActivities("runnnig").some((item) => item.name === "Running"));
  const mine = [{ name: "Playing with Zayla", icon: "shape-circle" }];
  assert.equal(searchActivities("playing Zayla", mine)[0]?.name, mine[0].name);
});

test("standalone scheduling advances to tomorrow after the last half-hour block", async () => {
  const { nextActivitySlot } = await import('./date-time');
  assert.deepEqual(nextActivitySlot(new Date('2026-12-31T23:45')), { date: '2027-01-01', startMinute: 0 });
  assert.deepEqual(nextActivitySlot(new Date('2026-11-01T14:05')), { date: '2026-11-01', startMinute: 870 });
});
