import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { remindersMiddleware } from "../server/reminders-api";
import { parseReminderPreferences, validReminderEmail, validTimeZone } from "./reminders";

const userId = "00000000-0000-4000-8000-000000000001";
const config = { SUPABASE_URL: "https://database.example.com", SUPABASE_PUBLISHABLE_KEY: "public-key",
  SUPABASE_SECRET_KEY: "synthetic-private-database-key", RESEND_API_KEY: "synthetic-private-email-key",
  REPORT_FROM: "My Day <reports@example.com>", REPORT_REPLY_TO: "lab@example.edu", APP_ORIGIN: "https://app.example.com",
  CRON_SECRET: "synthetic-private-scheduler-secret-123456789" };
async function server(fetcher: typeof fetch, overrides: Partial<typeof config> = {}) {
  const handler = remindersMiddleware({ ...config, ...overrides }, fetcher);
  const instance = createServer((req, res) => void handler(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  const address = instance.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  return { request: (body?: object, options: RequestInit = {}, path = "/api/reminders") => fetch(origin + path, {
    method: body ? "POST" : "GET", ...options,
    headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}), Authorization: "Bearer user-token", ...options.headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), close: () => new Promise<void>((resolve) => instance.close(() => resolve())) };
}
const pref = { email: "person@example.com", time_zone: "America/New_York", enabled: false, verified_at: null,
  confirmation_expires_at: new Date(Date.now() + 3600000).toISOString() };

test("reminder addresses, time zones and server preferences validate at the boundary", () => {
  assert.ok(validReminderEmail("person@example.com"));
  for (const value of ["bad", "a@example.com\r\nBcc:x@y.com", "a,b@example.com"]) assert.equal(validReminderEmail(value), false);
  assert.ok(validTimeZone("America/New_York"));
  assert.equal(validTimeZone("Mars/Unknown"), false);
  assert.throws(() => parseReminderPreferences({ email: "a", timeZone: "wrong", enabled: true, confirmed: true, pending: false }));
});

test("saving requires an authenticated account, explicit consent, and valid fields; identity always comes from authentication", async () => {
  let sent = 0, saved = 0;
  const api = await server(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: userId });
    if (url.endsWith("/rpc/request_activity_reminder")) {
      saved++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.owner_id, userId);
      assert.equal(body.recipient, "person@example.com");
      assert.match(body.token_hash, /^[a-f0-9]{64}$/);
      return Response.json(true);
    }
    if (url === "https://api.resend.com/emails") {
      sent++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.reply_to, "lab@example.edu");
      assert.deepEqual(body.to, ["person@example.com"]);
      const rawToken = /token=([a-f0-9]{64})/.exec(body.text)?.[1];
      assert.ok(rawToken);
      assert.doesNotMatch(body.text, /synthetic-private/);
      return Response.json({ id: "email-confirmation" });
    }
    assert.match(url, /activity_reminder_preferences/);
    assert.ok(url.includes(userId));
    assert.doesNotMatch(url, /confirmation_hash|unsubscribe_token/);
    return Response.json(pref);
  });
  try {
    assert.equal((await api.request(undefined, { headers: { Authorization: "" } })).status, 401);
    for (const change of [{ consent: false }, { email: "wrong" }, { timeZone: "Not/AZone" }]) {
      assert.equal((await api.request({ action: "save", enabled: true, email: "person@example.com", timeZone: "UTC", consent: true, ...change })).status, 400);
    }
    assert.equal((await api.request({ action: "save", padding: "x".repeat(5000) })).status, 413);
    assert.equal(saved, 0);
    assert.equal((await api.request({ action: "save", enabled: true, email: " Person@Example.com ", timeZone: "America/New_York", consent: true, userId: "someone-else" })).status, 200);
    assert.equal(saved, 1); assert.equal(sent, 1);
    assert.equal((await api.request({ action: "save", enabled: false }, { headers: { Origin: "https://other.example" } })).status, 403);
  } finally { await api.close(); }
});

test("confirmation and unsubscribe links do not mutate on GET; only valid POST tokens can change preferences", async () => {
  let updates = 0;
  const rawToken = "a".repeat(64);
  const api = await server(async (input, init) => {
    updates++;
    const url = String(input);
    const body = JSON.parse(String(init?.body));
    if (url.endsWith("confirm_activity_reminder")) assert.equal(body.token_hash, createHash("sha256").update(rawToken).digest("hex"));
    else { assert.ok(url.endsWith("unsubscribe_activity_reminder")); assert.equal(body.token, rawToken); }
    return Response.json(true);
  });
  try {
    for (const action of ["confirm", "unsubscribe"]) {
      const landing = await api.request(undefined, {}, `/api/reminders?action=${action}&token=${rawToken}`);
      assert.equal(landing.status, 200); assert.match(await landing.text(), /method="post"/);
      assert.equal(landing.headers.get("referrer-policy"), "no-referrer");
    }
    assert.equal(updates, 0);
    assert.equal((await api.request(undefined, {}, "/api/reminders?action=confirm&token=%3Cscript%3E")).status, 400);
    assert.equal((await api.request({ action: "confirm", token: rawToken }, { headers: { Authorization: "" } })).status, 200);
    assert.equal((await api.request({ action: "unsubscribe", token: rawToken }, { headers: { Authorization: "" } })).status, 200);
    assert.equal(updates, 2);
  } finally { await api.close(); }
});

test("the scheduler is private, rechecks eligibility, uses stable retry keys and records only accepted mail", async () => {
  let sent = 0, finished = 0;
  let due = true;
  const keys: string[] = [];
  const api = await server(async (input, init) => {
    const url = String(input);
    if (url.endsWith("claim_activity_reminders")) return Response.json([{ user_id: userId, local_date: "2026-10-29",
      email: "person@example.com", unsubscribe_token: "b".repeat(64), claim_id: "test-claim" }]);
    if (url.endsWith("activity_reminder_still_due")) return Response.json(due);
    if (url === "https://api.resend.com/emails") {
      sent++; keys.push(new Headers(init?.headers).get("idempotency-key") || "");
      const body = JSON.parse(String(init?.body));
      assert.match(body.text, /action=unsubscribe/);
      assert.doesNotMatch(body.text, /patient|mood|importance|synthetic-private/);
      return Response.json({ id: "accepted-reminder" });
    }
    assert.ok(url.endsWith("finish_activity_reminder"));
    finished++; return Response.json(null);
  });
  const run = () => api.request({ action: "run" }, { headers: { Authorization: `Bearer ${config.CRON_SECRET}` } });
  try {
    assert.equal((await api.request({ action: "run" })).status, 401);
    assert.deepEqual(await (await run()).json(), { accepted: 1, failed: 0, skipped: 0 });
    // A lease retry must produce exactly the same provider idempotency key.
    await run(); assert.equal(keys[0], keys[1]);
    due = false;
    assert.deepEqual(await (await run()).json(), { accepted: 0, failed: 0, skipped: 1 });
    assert.equal(sent, 2); assert.equal(finished, 2);
  } finally { await api.close(); }
});

test("provider failures stay retryable, and missing email configuration cannot block unsubscribe", async () => {
  const api = await server(async (input) => {
    assert.ok(String(input).endsWith("unsubscribe_activity_reminder")); return Response.json(true);
  }, { RESEND_API_KEY: "" });
  try {
    assert.equal((await api.request({ action: "unsubscribe", token: "c".repeat(64) })).status, 200);
    assert.equal((await api.request({ action: "run" }, { headers: { Authorization: `Bearer ${config.CRON_SECRET}` } })).status, 503);
  } finally { await api.close(); }
  let finishes = 0;
  const failing = await server(async (input) => {
    const url = String(input);
    if (url.endsWith("claim_activity_reminders")) return Response.json([{ user_id: userId, local_date: "2026-10-29", email: "person@example.com", unsubscribe_token: "d".repeat(64), claim_id: "test-claim" }]);
    if (url.endsWith("activity_reminder_still_due")) return Response.json(true);
    if (url.endsWith("finish_activity_reminder")) finishes++;
    return Response.json({ message: "private upstream details" }, { status: 503 });
  });
  try {
    const response = await failing.request({ action: "run" }, { headers: { Authorization: `Bearer ${config.CRON_SECRET}` } });
    assert.equal(response.status, 502); assert.equal(finishes, 0);
    assert.doesNotMatch(await response.text(), /private upstream|synthetic-private/);
  } finally { await failing.close(); }
});
