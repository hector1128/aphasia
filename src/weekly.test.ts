import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PDFDocument } from "pdf-lib";
import { type Entry, addSleep, emptyData, entriesInSlot, readData, saveActivity, saveEntry, setScheduledStatus } from "./model";
import { weeklyStats, weeklyReportData } from "./weekly";
import { buildWeeklyReportPdf } from "./report-week";
import { ScheduleControls } from "./ScheduleControls";
import { parseSpokenTime } from "./speech";
import { usernameAlias } from "./account-identity";
import { parseSnapshot } from "./cloud";
import { validateRequest } from "../server/report-api";
import { reportSections } from "./report-data";
const entry = (id: string, changes: Partial<Entry> = {}): Entry => ({
  id, name: "Walking", icon: "walk", date: "2026-10-14", startMinute: 999,
  source: "logged", status: "done", ...changes,
});

test("minute-precise entries and scheduled outcomes survive refresh and group in half-hour rows", () => {
  let data = saveEntry(emptyData(), entry("a", { startMinute: 1019 }));
  data = saveEntry(data, entry("b", { startMinute: 995, source: "scheduled", status: "missed", valueId: "value", lifeArea: "Recreation/interests" }));
  const restored = readData(JSON.stringify(data));
  assert.deepEqual(restored, data);
  assert.deepEqual(entriesInSlot(restored, "2026-10-14", 990).map((item) => item.id), ["b", "a"]);
  assert.equal(restored.entries.a.startMinute, 1019);
  assert.equal(entriesInSlot(restored, "2026-10-14", 1020).length, 0);
  const old = readData(JSON.stringify({ ...data, entries: { old: { ...entry("old"), source: undefined, status: "planned" } } }));
  assert.equal(old.entries.old.source, "scheduled");
});
test("only due scheduled activities offer outcomes and future plans cannot be completed", () => {
  const now = new Date("2026-10-14T17:00");
  const render = (value: Entry) => renderToStaticMarkup(createElement(ScheduleControls, { entry: value, now, onOutcome: () => {} }));
  assert.equal(render(entry("log")), "");
  assert.match(render(entry("future", { source: "scheduled", status: "planned", startMinute: 1200 })), /scheduled for later/);
  assert.match(render(entry("future", { source: "scheduled", status: "planned", startMinute: 1200 })), /disabled/);
  assert.match(render(entry("due", { source: "scheduled", status: "planned" })), /Complete and rate Walking/);
  assert.doesNotMatch(render(entry("due", { source: "scheduled", status: "planned" })), /<svg/);
  assert.match(render(entry("completed", { source: "scheduled", status: "done" })), /Mark Walking as not completed/);
  const data = saveEntry(emptyData(), entry("future", { source: "scheduled", status: "planned", startMinute: 1200 }));
  assert.equal(setScheduledStatus(data, "future", "done", now), data);
  const logged = saveEntry(data, entry("log"));
  assert.equal(setScheduledStatus(logged, "log", "missed", now), logged);
  const completed = saveEntry(emptyData(), entry("rated-plan", { source: "scheduled", mood: 9, rating: 8, importance: 7 }));
  const missed = setScheduledStatus(completed, "rated-plan", "missed", now);
  assert.equal(missed.entries["rated-plan"].mood, 9);
  const report = reportSections(missed, "2026-10-14").find((section) => section.title === "Activities and ratings");
  assert.doesNotMatch(JSON.stringify(report), /9\/10|8\/10|7\/10/);
});
test("exact sleep and wake times fill empty rows and preserve the measured duration", () => {
  let data = saveActivity(emptyData(), entry("sleep", { date: "2026-10-13", name: "Sleep", startMinute: 22 * 60 + 17 }));
  data = saveActivity(data, entry("wake", { name: "Wake up", startMinute: 7 * 60 + 19 }));
  assert.equal(data.sleeps.length, 1);
  assert.equal((Date.parse(data.sleeps[0].end) - Date.parse(data.sleeps[0].start)) / 60000, 542);
  assert.ok(entriesInSlot(data, "2026-10-14", 390).some((item) => item.sleepId));
  assert.equal(entriesInSlot(data, "2026-10-14", 420).some((item) => item.sleepId), false);
  const nap = addSleep(emptyData(), { id: "short-nap", start: "2026-10-14T10:01", end: "2026-10-14T10:29" }, new Date("2026-10-14T12:00"));
  assert.equal(entriesInSlot(nap, "2026-10-14", 600)[0]?.name, "Sleeping");
});
test("weekly metrics distinguish zero, missing data, due plans and a partial week", () => {
  let data = saveEntry({ ...emptyData(), name: "Test" }, entry("a", { date: "2026-10-12", mood: 0 }));
  data = saveEntry(data, entry("b", { source: "scheduled", mood: 8 }));
  data = saveEntry(data, entry("c", { source: "scheduled", status: "missed" }));
  data = saveEntry(data, entry("d", { source: "scheduled", status: "planned" }));
  data = saveEntry(data, entry("future", { date: "2026-10-18", source: "scheduled", status: "planned" }));
  data.ratings = { "2026-10-12": 0, "2026-10-14": 6, "2026-10-19": 9 };
  data.mindfulness = [{ id: "m", date: "2026-10-14", kind: "breathing", status: "completed" }];
  data.sleeps = [{ id: "sleep", start: "2026-10-13T23:00", end: "2026-10-14T07:00" }];
  const stats = weeklyStats(data, "2026-10-14", new Date("2026-10-14T19:00"));
  assert.equal(stats.elapsedDays, 3);
  assert.equal(stats.totalActivities, 2);
  assert.equal(stats.averageActivities, 2 / 3);
  assert.equal(stats.daysLogged, 2);
  assert.equal(stats.duePlans, 3);
  assert.equal(stats.completionRate, 1 / 3);
  assert.equal(stats.unansweredPlans, 1);
  assert.equal(stats.missedPlans, 1);
  assert.equal(stats.averageSleep, 8);
  assert.equal(stats.sleepDays, 1);
  assert.equal(stats.mindfulness, 1);
  assert.equal(stats.daily[0].dailyMood, 0);
  assert.equal(stats.daily[0].activityMood, 0);
  assert.equal(stats.daily[1].dailyMood, undefined);
  assert.equal(stats.daily[2].dailyMood, 6);
  assert.equal(stats.daily[2].activityMood, 8);
  const filtered = weeklyReportData(data, "2026-10-14");
  assert.equal(filtered.ratings["2026-10-19"], undefined);
  assert.equal(validateRequest({ to: "test@example.com", date: "2026-10-14", period: "week", data }).period, "week");
  assert.throws(() => validateRequest({ to: "test@example.com", date: "2026-10-14", period: "invalid", data: { ...data, name: "Test" } }));
});
test("weekly PDF remains valid with missing data and many long activity names", async () => {
  const data = emptyData(); data.name = "Design Test";
  for (let i = 0; i < 70; i++) data.entries[String(i)] = entry(String(i), { name: "Activity name ".repeat(7) });
  const pdf = await PDFDocument.load(await buildWeeklyReportPdf(data, "2026-10-14", new Date("2026-10-16T12:00")));
  assert.ok(pdf.getPageCount() >= 4);
  assert.ok((await buildWeeklyReportPdf(emptyData(), "2027-01-01")).length > 1000);
});
test("voice time parsing supports noon, midnight and spoken minutes without guessing a period", () => {
  for (const [speech, minute] of [["four thirty-nine PM", 999], ["4:39pm", 999], ["439 PM", 999], ["twelve AM", 0], ["12 PM", 720], ["eleven fifty-nine p.m.", 1439], ["ten oh five am", 605]] as const)
    assert.equal(parseSpokenTime(speech), minute, speech);
  for (const speech of ["four thirty", "13:15 pm", "four sixty PM", "something else"])
    assert.equal(parseSpokenTime(speech), undefined, speech);
});
test("account names are case insensitive and snapshots require a valid version and revision", async () => {
  assert.equal(await usernameAlias("  Alex  Smith "), await usernameAlias("alex smith"));
  assert.notEqual(await usernameAlias("Alex Smith 2"), await usernameAlias("Alex Smith"));
  await assert.rejects(usernameAlias("a"));
  const data = emptyData();
  assert.deepEqual(parseSnapshot({ data, revision: 1 }), { data, revision: 1 });
  assert.throws(() => parseSnapshot({ data: {}, revision: 1 }));
  assert.throws(() => parseSnapshot({ data, revision: -1 }));
});
