import { test } from "node:test";
import type { SendMailOptions } from "nodemailer";
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
  setScheduledStatus,
  Entry,
} from "./model";
import { reportData, reportSections } from "./report-data";
import { buildReportPdf } from "./report";
import { mainActivities, searchableActivities, catalogueActivity, suggestedActivities } from "./activity-catalogue";
import { ActivityPicker } from "./ActivityPicker";
import { ScheduleValuePicker } from "./Values";
import { PDFDocument } from "pdf-lib";
import { validateRequest, reportMiddleware } from "../server/report-api";
import { createServer, request } from "node:http";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityIcon, hasActivityIcon } from "./ActivityIcon";
import { DayTimeline } from "./DayTimeline";
const make = (id: string, changes: Partial<Entry> = {}): Entry => ({
  id,
  name: "Walking",
  icon: "walk",
  date: "2026-10-01",
  startMinute: 540,
  status: "done",
  source: changes.status === "planned" || changes.status === "missed" ? "scheduled" : "logged",
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
  assert.equal(suggestedActivities(data).length, 5);
  assert.ok(suggestedActivities(data).every((a) => !sleepBoundary(a.name)));
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
  const completed = setScheduledStatus(original, "plan", "done");
  assert.equal(completed.entries.plan.status, "done");
  assert.deepEqual(
    [completed.entries.plan.mood, completed.entries.plan.rating, completed.entries.plan.importance],
    [6, 8, 9],
  );
  assert.equal(setScheduledStatus(completed, "plan", "planned").entries.plan.status, "planned");
  assert.equal(original.entries.plan.status, "planned");
});
test("sleep markers rebuild the interval when their completion changes", () => {
  let data = saveActivity(emptyData(), make("bed", {
    name: "Went to bed", date: "2026-09-30", startMinute: 1320, source: "scheduled",
  }));
  data = saveActivity(data, make("wake", {
    name: "Wake up", date: "2026-10-01", startMinute: 390, source: "scheduled",
  }));
  assert.equal(data.sleeps.length, 1);
  data = setScheduledStatus(data, "wake", "planned");
  assert.equal(data.entries.wake.status, "planned");
  assert.equal(data.sleeps.length, 0);
  assert.equal(Object.values(data.entries).filter((entry) => entry.sleepId).length, 0);
  data = setScheduledStatus(data, "wake", "done");
  assert.equal(data.sleeps.length, 1);
  data = setScheduledStatus(data, "bed", "planned");
  assert.equal(data.sleeps.length, 0);
});
test("main tracker catalogue covers life areas and preserves the searchable library", () => {
  assert.equal(mainActivities.length, 21);
  assert.ok(mainActivities.every((activity) => activity.areas.length && activity.features.length));
  assert.ok(searchableActivities.some((activity) => activity.name === "Playing piano"));
  assert.ok(searchableActivities.some((activity) => activity.name === "Participate in research"));
  assert.equal(new Set(searchableActivities.map((activity) => activity.name.toLowerCase())).size, searchableActivities.length);
  assert.equal(catalogueActivity(" Reading ")?.name, "Read");
  assert.equal(catalogueActivity("Cleaning/Doing chores")?.name, "Cleaning | Doing chores");
});
test("calendar entries show the activity name without a rating", () => {
  const data = saveEntry(emptyData(), make("rated", { rating: 5 }));
  const html = renderToStaticMarkup(createElement(DayTimeline, {
    date: "2026-10-01",
    data,
    onAdd: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onToggle: () => {},
  }));
  assert.match(html, /Walking/);
  assert.doesNotMatch(html, /Enjoyment 5/);
});
test("suggestions discover five unseen activities and exclude equivalent names and pending plans", () => {
  const data = saveEntry(saveEntry(emptyData(), make("read", { name: "Reading" })),
    make("planned", { name: "Watching television", source: "scheduled", status: "planned" }));
  const suggestions = suggestedActivities(data, new Date("2026-10-02T12:00:00"));
  assert.equal(suggestions.length, 5);
  assert.equal(new Set(suggestions.map((a) => a.name)).size, 5);
  assert.ok(suggestions.every((a) => !["Read", "Watch TV", "Sleep", "Wake up"].includes(a.name)));
  assert.ok(suggestions.some((a) => a.name === "Write in journal"));
});
test("similar experiences influence recommendations without counting as the same activity", () => {
  assert.equal(catalogueActivity("Taking a bus"), undefined);
  assert.equal(catalogueActivity("Resting"), undefined);
  const data = saveEntry(emptyData(), make("rest", { name: "Resting" }));
  assert.ok(suggestedActivities(data).some((choice) => choice.name === "Practicing mindfulness"));
});
test("new users get general starters; exhausted catalogues never repeat tried activities", () => {
  assert.deepEqual(suggestedActivities(emptyData()).map((a) => a.name),
    ["Eat a meal", "Call | On the phone", "Read", "Practicing mindfulness", "Spending time with loved ones"]);
  const data = emptyData();
  for (const [index, activity] of mainActivities.entries()) data.entries[String(index)] = make(String(index), activity);
  assert.deepEqual(suggestedActivities(data), []);
});
test("recent and repeated activity features influence suggestions", () => {
  const now = new Date("2026-10-16T12:00:00");
  const data = saveEntry(saveEntry(emptyData(), make("read", { name: "Read", date: "2020-01-01" })),
    make("family", { name: "Visiting family", date: "2026-10-16" }));
  assert.equal(suggestedActivities(data, now)[0].name, "Call | On the phone");
  for (let index = 0; index < 10; index++) data.entries[`read-${index}`] = make(`read-${index}`, { name: "Read", date: "2026-10-16" });
  assert.notEqual(suggestedActivities(data, now)[0].name, "Call | On the phone");
});
test("custom activities can contribute an explicit life area without inventing name matches", () => {
  const data = saveEntry(emptyData(), make("custom", { name: "My own activity", lifeArea: "Personal relationships" }));
  assert.ok(suggestedActivities(data).slice(0, 2).every((choice) => catalogueActivity(choice.name)?.areas.includes("Personal relationships")));
});
test("full-library history contributes meaningful features without trusting custom artwork", () => {
  const now = new Date("2026-10-16T12:00:00");
  const music = saveEntry(emptyData(), make("music", { name: "Playing piano", icon: "custom", date: "2026-10-16" }));
  const suggestions = suggestedActivities(music, now);
  assert.ok(suggestions.some((choice) => choice.name === "Cook"));
  assert.ok(suggestions.some((choice) => choice.name === "Watch TV"));
  const custom = saveEntry(emptyData(), make("custom", { name: "My own activity", icon: "music", date: "2026-10-16" }));
  assert.deepEqual(suggestedActivities(custom, now), suggestedActivities(emptyData(), now));
});
test("picker opens with actual recent and suggested choices; scheduling shows personal values", () => {
  const data = emptyData();
  const html = renderToStaticMarkup(createElement(ActivityPicker, {
    value: { name: "", icon: "custom" }, recent: [{ name: "Playing piano", icon: "music" }],
    suggestions: suggestedActivities(data), onChange: () => {},
  }));
  assert.ok(html.indexOf("Playing piano") < html.indexOf("Eat a meal"));
  assert.match(html, /Choose a life area/);
  assert.doesNotMatch(html, /Need suggestions/);
  data.values = [{ id: "family", area: "Personal relationships", name: "Stay connected", activities: [] }];
  const values = renderToStaticMarkup(createElement(ScheduleValuePicker, {
    data, onChange: () => {}, onDataChange: () => {}, valueId: "family", area: "Personal relationships",
  }));
  assert.match(values, /Stay connected/);
  assert.match(values, /aria-pressed="true"/);
  assert.match(values, /Add a value/);
  assert.doesNotMatch(values, />Personal relationships</);
});
test("report isolates selected day, distinguishes missing from zero and includes all life areas", () => {
  const data = saveEntry(
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
  let message: SendMailOptions | undefined;
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
    assert.ok(message);
    assert.equal(message.to, "recipient@example.com");
    const content = message.attachments?.[0].content;
    assert.ok(Buffer.isBuffer(content));
    assert.equal(content.subarray(0, 4).toString(), "%PDF");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("weekly email attaches a weekly PDF and hosted sending requires sign-in", async () => {
  const data = { ...emptyData(), name: "Weekly Test" };
  const messages: SendMailOptions[] = [];
  const middleware = reportMiddleware({ REPORT_FROM: "sender@example.com" }, async (mail) => {
    messages.push(mail);
    return { accepted: [mail.to], rejected: [] };
  });
  const server = createServer(async (req, res) => {
    if (req.headers["x-test-preparsed"]) {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      Object.assign(req, { body: JSON.parse(raw) });
    }
    await middleware(req, res, () => res.end());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}`;
    const unauthorized = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(`${url}/api/report`, {
        method: "POST", headers: { Origin: "https://app.example", Host: "app.example", "Content-Type": "application/json" },
      }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on("error", reject); req.end("{}");
    });
    assert.equal(unauthorized, 401);
    assert.equal(messages.length, 0);
    const result = await fetch(`${url}/api/report`, {
      method: "POST", headers: { Origin: url, "Content-Type": "application/json", "X-Test-Preparsed": "true" },
      body: JSON.stringify({ to: "recipient@example.com", date: "2026-10-14", period: "week", data }),
    });
    assert.equal(result.status, 200);
    const message = messages[0];
    assert.ok(message);
    assert.match(message.subject ?? "", /weekly/);
    const filename = message.attachments?.[0].filename;
    assert.equal(typeof filename, "string");
    assert.match(String(filename), /my-day-week/);
    const content = message.attachments?.[0].content;
    assert.ok(Buffer.isBuffer(content));
    assert.ok((await PDFDocument.load(content)).getPageCount() >= 3);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
