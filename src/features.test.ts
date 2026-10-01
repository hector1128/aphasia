import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  currentSlot,
  dateKey,
  entriesInSlot,
  readData,
  saveEntry,
  saveActivity,
  sleepBoundary,
  addSleep,
  removeSleep,
  removeEntry,
  toggleEntryStatus,
  suggestedActivities,
  Entry,
} from "./model";
import { reportData, reportSections } from "./report-data";
import { buildReportPdf } from "./report";
import {
  activities,
  activityCategories,
  categoryActivities,
} from "./activities";
import { PDFDocument } from "pdf-lib";
import { validateRequest, reportMiddleware } from "../server/report-api";
import { createServer } from "node:http";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityIcon, hasActivityIcon } from "./ActivityIcon";
const make = (id: string, changes: Partial<Entry> = {}): Entry => ({
  id,
  name: "Walking",
  icon: "walk",
  date: "2026-10-01",
  startMinute: 540,
  status: "done",
  ...changes,
});
test("custom activities without a matching picture have no fallback icon", () => {
  assert.equal(hasActivityIcon("custom", "My own activity"), false);
  assert.equal(renderToStaticMarkup(createElement(ActivityIcon, { id: "custom", name: "My own activity" })), "");
  assert.equal(hasActivityIcon("custom", "Grocery shopping"), true);
});
test("zero ratings, importance, values, and mindfulness survive storage", () => {
  const data = saveEntry(
    emptyData(),
    make("x", { mood: 0, rating: 0, importance: 0 }),
  );
  data.ratings["2026-10-01"] = 0;
  data.values = [
    {
      id: "v",
      name: "Being together",
      area: "Personal relationships",
      activities: [{ name: "Walking", icon: "walk" }],
    },
  ];
  data.mindfulness = [
    { id: "s", date: "2026-10-01", kind: "breathing", status: "completed" },
  ];
  data.email = "test@example.com";
  assert.deepEqual(readData(JSON.stringify(data)), data);
});
test("sleep spans midnight without replacing entries; repeat and removal are safe", () => {
  let data = saveEntry(
    emptyData(),
    make("a", { date: "2026-09-30", startMinute: 1410 }),
  );
  const record = {
    id: "night",
    start: "2026-09-30T23:00",
    end: "2026-10-01T01:00",
  };
  data = addSleep(data, record, new Date("2026-10-01T10:00"));
  assert.equal(Object.keys(data.entries).length, 4);
  assert.equal(data.entries.a.name, "Walking");
  assert.equal(
    Object.values(data.entries).filter((e) => e.date === "2026-10-01").length,
    2,
  );
  const repeated = addSleep(
    data,
    { ...record, id: "again" },
    new Date("2026-10-01T10:00"),
  );
  assert.equal(Object.keys(repeated.entries).length, 4);
  assert.deepEqual(Object.keys(removeSleep(data, "night").entries), ["a"]);
  assert.throws(() => addSleep(data, { ...record, end: "2026-09-30T22:00" }));
  assert.throws(() => addSleep(data, { ...record, end: "2026-10-02T01:00" }));
});
test("completed sleep and wake phrases create a sleep interval automatically", () => {
  assert.equal(sleepBoundary("I went to bed"), "sleep");
  assert.equal(sleepBoundary("Woke up"), "wake");
  assert.equal(sleepBoundary("SLEEPING"), "sleep");
  assert.equal(sleepBoundary("Falling asleep"), "sleep");
  assert.equal(sleepBoundary("Getting up"), "wake");
  let data = saveActivity(
    emptyData(),
    make("bed", { name: "Went to bed", date: "2026-09-30", startMinute: 1320 }),
  );
  assert.ok(data.pendingSleepStart);
  data = saveActivity(
    data,
    make("wake", { name: "Wake up", date: "2026-10-01", startMinute: 390, mood: undefined, rating: undefined }),
  );
  assert.equal(data.pendingSleepStart, undefined);
  assert.equal(data.sleeps.length, 1);
  assert.equal(data.sleeps[0].end, "2026-10-01T10:30:00.000Z");
  assert.ok(Object.values(data.entries).some((e) => e.sleepId === data.sleeps[0].id));
  assert.equal(suggestedActivities(data).length, 0);
  const withoutBed = removeEntry(data, "bed");
  assert.equal(withoutBed.sleeps.length, 0);
  assert.equal(Object.values(withoutBed.entries).some((e) => e.sleepId), false);
});
test("sleep and wake fill every empty half-hour until wake-up", () => {
  let data = saveActivity(
    emptyData(),
    make("sleep-start", {
      name: "Sleep",
      date: "2026-09-30",
      startMinute: 22 * 60,
    }),
  );
  data = saveActivity(
    data,
    make("wake-end", {
      name: "Wake up",
      date: "2026-10-01",
      startMinute: 7 * 60,
    }),
  );
  assert.equal(data.sleeps.length, 1);
  assert.equal(Object.values(data.entries).filter((entry) => entry.sleepId).length, 17);
  for (
    const time = new Date("2026-09-30T22:30");
    time < new Date("2026-10-01T07:00");
    time.setMinutes(time.getMinutes() + 30)
  ) {
    assert.ok(
      entriesInSlot(data, dateKey(time), currentSlot(time)).some((entry) => entry.sleepId),
      `Missing sleep at ${time.toString()}`,
    );
  }
  assert.equal(entriesInSlot(data, "2026-10-01", 7 * 60).some((entry) => entry.sleepId), false);
});
test("confirming a scheduled wake-up closes its sleep period", () => {
  const bed = make("bed-plan", {
    name: "Bedtime",
    date: "2026-09-30",
    startMinute: 1320,
    status: "planned",
  });
  const wake = make("wake-plan", {
    name: "Waking up",
    date: "2026-10-01",
    startMinute: 390,
    status: "planned",
  });
  let data = saveActivity(emptyData(), bed);
  data = saveActivity(data, { ...bed, status: "done" });
  data = saveActivity(data, wake);
  data = saveActivity(data, { ...wake, status: "done" });
  assert.equal(data.sleeps.length, 1);
  assert.equal(data.pendingSleepStart, undefined);
});
test("completion toggle preserves ratings and can be reversed", () => {
  const planned = make("plan", { status: "planned", mood: 6, rating: 8, importance: 9 });
  const original = saveActivity(emptyData(), planned);
  const completed = toggleEntryStatus(original, "plan");
  assert.equal(completed.entries.plan.status, "done");
  assert.deepEqual(
    [completed.entries.plan.mood, completed.entries.plan.rating, completed.entries.plan.importance],
    [6, 8, 9],
  );
  assert.equal(toggleEntryStatus(completed, "plan").entries.plan.status, "planned");
  assert.equal(original.entries.plan.status, "planned");
});
test("sleep markers rebuild the interval when their completion changes", () => {
  let data = saveActivity(emptyData(), make("bed", {
    name: "Went to bed", date: "2026-09-30", startMinute: 1320,
  }));
  data = saveActivity(data, make("wake", {
    name: "Wake up", date: "2026-10-01", startMinute: 390,
  }));
  assert.equal(data.sleeps.length, 1);
  data = toggleEntryStatus(data, "wake");
  assert.equal(data.entries.wake.status, "planned");
  assert.equal(data.sleeps.length, 0);
  assert.equal(Object.values(data.entries).filter((entry) => entry.sleepId).length, 0);
  data = toggleEntryStatus(data, "wake");
  assert.equal(data.sleeps.length, 1);
  data = toggleEntryStatus(data, "bed");
  assert.equal(data.sleeps.length, 0);
});
test("every activity is in exactly one category", () => {
  const all = activityCategories.flatMap((c) => categoryActivities(c.name));
  assert.equal(all.length, activities.length);
  assert.equal(new Set(all.map((a) => a.name)).size, activities.length);
});
test("suggestions prefer enjoyed and valued activities, ignore planned/sleep, deduplicate", () => {
  let data = saveEntry(
    saveEntry(emptyData(), make("low", { rating: 0 })),
    make("high", { name: "Reading", rating: 10 }),
  );
  data = saveEntry(
    data,
    make("planned", { name: "Shopping", status: "planned", rating: 10 }),
  );
  data.values = [
    {
      id: "v",
      area: "Mind/body/spirit",
      name: "Calm",
      activities: [{ name: "Reading", icon: "read" }],
    },
  ];
  const suggestions = suggestedActivities(data);
  assert.equal(suggestions[0].name, "Reading");
  assert.equal(suggestions.length, 2);
  assert.deepEqual(suggestedActivities(emptyData()), []);
});
test("report isolates selected day, distinguishes missing from zero and includes all life areas", () => {
  let data = saveEntry(
    saveEntry(
      emptyData(),
      make("today", { mood: 0, rating: 0, importance: 0 }),
    ),
    make("yesterday", { date: "2026-09-30", name: "PRIVATE OLD ENTRY" }),
  );
  data.ratings = { "2026-09-30": 9, "2026-10-01": 0 };
  data.mindfulness = [
    { id: "s", date: "2026-09-30", kind: "breathing", status: "completed" },
  ];
  const result = reportData(data, "2026-10-01");
  assert.equal(Object.keys(result.entries).length, 1);
  assert.equal(result.mindfulness.length, 0);
  const text = JSON.stringify(reportSections(result, "2026-10-01"));
  assert.ok(text.includes("Daily mood: 0/10"));
  assert.ok(text.includes("Importance: 0/10"));
  assert.ok(text.includes("Not completed"));
  assert.ok(!text.includes("PRIVATE OLD ENTRY"));
  assert.equal(
    reportSections(result, "2026-10-01").filter((s) =>
      s.title.startsWith("Values:"),
    ).length,
    5,
  );
});
test("PDF handles empty and many long entries across pages", async () => {
  const data = emptyData();
  data.name = "Test Person";
  for (let i = 0; i < 55; i++)
    data.entries[String(i)] = make(String(i), {
      name: "Long activity name ".repeat(8),
      startMinute: (i % 48) * 30,
    });
  const pdf = await PDFDocument.load(await buildReportPdf(data, "2026-10-01"));
  assert.ok(pdf.getPageCount() > 3);
  assert.ok((await buildReportPdf(emptyData(), "2026-10-01")).length > 1000);
});
test("email rejects malformed addresses and attaches an actual PDF using a mock transport", async () => {
  const data = emptyData();
  data.name = "Test";
  assert.throws(() =>
    validateRequest({
      to: "a@example.com\r\nBcc: b@example.com",
      date: "2026-10-01",
      data,
    }),
  );
  let message: any;
  const middleware = reportMiddleware(
    { REPORT_FROM: "sender@example.com" },
    async (m) => {
      message = m;
      return { accepted: [m.to], rejected: [] };
    },
  );
  const server = createServer(
    (req, res) =>
      void middleware(req, res, () => {
        res.writeHead(404);
        res.end();
      }),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    const rejected = await fetch(`${url}/api/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://outside.example",
      },
      body: JSON.stringify({
        to: "recipient@example.com",
        date: "2026-10-01",
        data,
      }),
    });
    assert.equal(rejected.status, 403);
    const result = await fetch(`${url}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: url },
      body: JSON.stringify({
        to: "recipient@example.com",
        date: "2026-10-01",
        data,
      }),
    });
    assert.equal(result.status, 200);
    assert.equal(message.to, "recipient@example.com");
    assert.equal(
      message.attachments[0].content.subarray(0, 4).toString(),
      "%PDF",
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
