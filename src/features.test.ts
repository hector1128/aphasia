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
import { activityCategories, mainActivities, suggestionActivities, searchableActivities, catalogueActivity, suggestedActivities } from "./activity-catalogue";
import { TimePicker } from "./DateTimePicker";
import { ActivityPicker } from "./ActivityPicker";
import { ScheduleValuePicker } from "./Values";
import { FaceSettings } from "./FaceSettings";
import { PDFDocument } from "pdf-lib";
import { validateRequest, reportMiddleware } from "../server/report-api";
import { createServer, request } from "node:http";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityIcon } from "./ActivityIcon";
import { RatingSlider } from "./RatingSlider";
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
test("all activity choices and custom entries use Lucide icons instead of illustrations", () => {
  for (const choice of [...searchableActivities, { name: "My own activity", icon: "custom" }]) {
    const html = renderToStaticMarkup(createElement(ActivityIcon, { id: choice.icon, name: choice.name }));
    assert.match(html, /<svg/);
    assert.match(html, /class="lucide lucide-[^"]+ activity-icon"/);
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /<img|<image|illustrations\//);
  }
  for (const [name, icon] of [["Grocery shopping", "shopping-cart"], ["Video call", "video"], ["Biking", "bike"], ["Speech practice", "speech"], ["My own activity", "activity"]]) {
    assert.ok(renderToStaticMarkup(createElement(ActivityIcon, { id: "custom", name })).includes(`lucide-${icon}`));
  }
  assert.match(renderToStaticMarkup(createElement(ActivityIcon, { id: "mindfulness" })), /lucide-brain/);
});
test("only importance rating six uses the replacement star card", () => {
  const html = renderToStaticMarkup(createElement(RatingSlider, { value: 6, label: "Importance", onChange: () => {} }));
  assert.match(html, /href="\/ratings\/importance-6.png"/);
  assert.match(html, /aria-label="Importance 6 out of 10"/);
  for (const label of ["Importance", "Enjoyment", "Mood"] as const) {
    const other = renderToStaticMarkup(createElement(RatingSlider, { value: label === "Importance" ? 7 : 6, label, onChange: () => {} }));
    assert.doesNotMatch(other, /importance-6.png/);
  }
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
test("activity browsing has the nine requested categories and exact choices", () => {
  assert.deepEqual(activityCategories.map(({ name, activities }) => [name, activities.map((activity) => activity.name).join("; ")]), [
    ["Food and drinks", "Breakfast; Lunch; Dinner; Snack; Coffee or tea; Eating out"],
    ["Sleep and rest", "Sleeping; Nap; Resting"],
    ["Personal care", "Shower or bath; Getting dressed; Brushing teeth; Hair and grooming"],
    ["Time with others", "Visiting family; Visiting friends; Time with partner; Gathering or celebration; Phone call; Video call; Texting"],
    ["Home and errands", "Cooking; Cleaning; Laundry; Pet care; Gardening; Home repairs; Grocery shopping; Other shopping"],
    ["Exercise", "Walking; Running; Biking; Swimming; Stretching or yoga; Workout; Playing a sport"],
    ["Hobbies and fun", "Reading; Watching TV; Listening to music; Board and card games; Video games; Arts and crafts; Making music; Going to an event"],
    ["Work and community", "Working; Taking a class; Volunteering; Religious service; Caring for someone; Taking a trip"],
    ["Health and therapy", "Doctor appointment; Speech therapy; Speech practice; Other therapy; Support group"],
  ]);
  assert.equal(mainActivities.length, 54);
  assert.ok(mainActivities.every((activity) => activity.areas.length && activity.features.length));
});
test("new activities preserve legacy search and recognize equivalent names without merging distinct choices", () => {
  for (const name of ["Playing piano", "Participate in research", "Aphasia House", "Make a smoothie"])
    assert.ok(searchableActivities.some((activity) => activity.name === name));
  assert.equal(new Set(searchableActivities.map((activity) => activity.name.toLowerCase())).size, searchableActivities.length);
  assert.equal(catalogueActivity(" Read ")?.name, "Reading");
  assert.equal(catalogueActivity("Cleaning/Doing chores")?.name, "Cleaning");
  assert.equal(catalogueActivity("At Aphasia House")?.name, "Aphasia House");
  for (const name of ["Breakfast", "Lunch", "Dinner", "Walking", "Running", "Swimming", "Speech practice", "Speech therapy"])
    assert.equal(catalogueActivity(name)?.name, name);
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
test("suggestions use only the separate pool and exclude completed aliases and pending plans", () => {
  const data = saveEntry(saveEntry(emptyData(), make("artist", { name: "Listen to a new artist" })),
    make("planned", { name: "Making a playlist", source: "scheduled", status: "planned" }));
  const suggestions = suggestedActivities(data, new Date("2026-10-02T12:00:00"));
  assert.equal(suggestionActivities.length, 84);
  assert.equal(new Set(suggestionActivities.map((activity) => activity.name)).size, 84);
  assert.equal(suggestions.length, 5);
  assert.equal(new Set(suggestions.map((a) => a.name)).size, 5);
  assert.ok(suggestions.every((a) => suggestionActivities.some((candidate) => candidate.name === a.name)));
  assert.ok(suggestions.every((a) => !["Listen to a new artist", "Make a playlist"].includes(a.name)));
});
test("similar experiences influence recommendations without counting as the same activity", () => {
  assert.equal(catalogueActivity("Taking a bus"), undefined);
  assert.equal(catalogueActivity("Resting")?.name, "Resting");
  const data = saveEntry(emptyData(), make("rest", { name: "Resting" }));
  assert.ok(suggestedActivities(data).some((choice) => choice.name === "Watch the sunset"));
});
test("new users get general starters; exhausted suggestion pools never repeat tried activities", () => {
  assert.deepEqual(suggestedActivities(emptyData()).map((a) => a.name),
    ["Listen to a new artist", "Try a new fruit", "Send a photo to a friend", "Color a picture", "Watch the sunset"]);
  const data = emptyData();
  for (const [index, activity] of suggestionActivities.entries()) data.entries[String(index)] = make(String(index), activity);
  assert.deepEqual(suggestedActivities(data), []);
});
test("recent and repeated activity features influence suggestions", () => {
  const now = new Date("2026-10-16T12:00:00");
  const data = saveEntry(saveEntry(emptyData(), make("read", { name: "Read", date: "2020-01-01" })),
    make("family", { name: "Visiting family", date: "2026-10-16" }));
  assert.equal(suggestedActivities(data, now)[0].name, "Send a photo to a friend");
  for (let index = 0; index < 10; index++) data.entries[`read-${index}`] = make(`read-${index}`, { name: "Read", date: "2026-10-16" });
  assert.notEqual(suggestedActivities(data, now)[0].name, "Send a photo to a friend");
});
test("custom activities can contribute an explicit life area without inventing name matches", () => {
  const data = saveEntry(emptyData(), make("custom", { name: "My own activity", lifeArea: "Personal relationships" }));
  assert.ok(suggestedActivities(data).slice(0, 2).every((choice) => catalogueActivity(choice.name)?.areas.includes("Personal relationships")));
});
test("full-library history contributes meaningful features without trusting custom artwork", () => {
  const now = new Date("2026-10-16T12:00:00");
  const music = saveEntry(emptyData(), make("music", { name: "Playing piano", icon: "custom", date: "2026-10-16" }));
  const suggestions = suggestedActivities(music, now);
  assert.ok(suggestions.some((choice) => choice.name === "Make a playlist"));
  assert.ok(suggestions.some((choice) => choice.name === "Listen to a new artist"));
  const custom = saveEntry(emptyData(), make("custom", { name: "My own activity", icon: "music", date: "2026-10-16" }));
  assert.deepEqual(suggestedActivities(custom, now), suggestedActivities(emptyData(), now));
});
test("time controls share one microphone beside the formatted time", () => {
  const html = renderToStaticMarkup(createElement(TimePicker, { value: 16 * 60 + 39, onChange: () => {} }));
  assert.match(html, /4:39 PM/);
  assert.equal((html.match(/aria-label="Dictate time"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Type a time instead|Say a time|Dictate Hour|Dictate Minute/);
  assert.ok(html.indexOf('aria-label="Hour"') < html.indexOf('aria-label="Minute"'));
  assert.ok(html.indexOf('aria-label="Minute"') < html.indexOf('aria-label="AM or PM"'));
});
test("picker separates recent, suggested and other activities; scheduling shows personal values", () => {
  const data = emptyData();
  const html = renderToStaticMarkup(createElement(ActivityPicker, {
    value: { name: "", icon: "custom" }, recent: [{ name: "Playing piano", icon: "music" }],
    suggestions: suggestedActivities(data), onChange: () => {},
  }));
  assert.ok(html.indexOf("Playing piano") < html.indexOf("Listen to a new artist"));
  assert.match(html, /<h2>Most recent<\/h2>/);
  assert.match(html, /<h2>Suggestions<\/h2>/);
  assert.match(html, /<h2>Activities<\/h2>/);
  assert.ok(html.indexOf("Most recent") < html.indexOf("Suggestions"));
  assert.doesNotMatch(html, /Need suggestions/);
  for (const category of activityCategories) assert.ok(html.includes(category.name));
  assert.doesNotMatch(html, /Personal relationships|Daily responsibilities/);
  data.values = [{ id: "family", area: "Personal relationships", name: "Stay connected", activities: [] }];
  const values = renderToStaticMarkup(createElement(ScheduleValuePicker, {
    data, onChange: () => {}, onDataChange: () => {}, valueId: "family", area: "Personal relationships",
  }));
  assert.match(values, /Stay connected/);
  assert.match(values, /aria-pressed="true"/);
  assert.match(values, /Add a value/);
  assert.doesNotMatch(values, />Personal relationships</);
});
test("the logging picker shows recent and other activities without suggestions", () => {
  const html = renderToStaticMarkup(createElement(ActivityPicker, {
    value: { name: "", icon: "custom" }, recent: [{ name: "Reading", icon: "read" }], onChange: () => {},
  }));
  assert.match(html, /<h2>Most recent<\/h2>/);
  assert.match(html, /<h2>Activities<\/h2>/);
  assert.doesNotMatch(html, /<h2>Suggestions<\/h2>/);
  assert.doesNotMatch(html, /Make a smoothie|Make a greeting card|Try clay modeling/);
});
test("a selected activity populates the textbox and shows its card with the library collapsed", () => {
  const html = renderToStaticMarkup(createElement(ActivityPicker, {
    value: { name: "Taking care of pets", icon: "pets" }, recent: [], suggestions: [], onChange: () => {},
  }));
  assert.match(html, /value="Taking care of pets"/);
  assert.match(html, /aria-label="Selected activity"/);
  assert.doesNotMatch(html, /aria-label="Activity choices"/);
  assert.match(html, /<span>Taking care of pets<\/span>/);
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
test("face settings stay visible while checking availability", () => {
  const html = renderToStaticMarkup(createElement(FaceSettings, { userId: "00000000-0000-4000-8000-000000000001", username: "Alex" }));
  assert.match(html, /Face sign-in<\/h2>/);
  assert.match(html, /Checking face sign-in/);
  assert.match(html, /disabled=""[^>]*>[\s\S]*Set up face sign-in/);
});

test("local-only settings explain why face setup needs an account", () => {
  const html = renderToStaticMarkup(createElement(FaceSettings, { username: "Alex" }));
  assert.match(html, /Face sign-in<\/h2>/);
  assert.match(html, /Sign in to your account with your password/);
  assert.doesNotMatch(html, /Checking face sign-in/);
});
