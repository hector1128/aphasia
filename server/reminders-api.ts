import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cloudConfig } from "../src/cloud-config.js";
import { validReminderEmail, validTimeZone } from "../src/reminders.js";
import { sendResend } from "./email.js";

type Config = Record<string, string | undefined>;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const isToken = (token: unknown): token is string => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
const preferenceColumns = "email,time_zone,enabled,verified_at,confirmation_expires_at";
function summary(row: unknown) {
  const pref = row && typeof row === "object" ? row : {};
  return { email: "email" in pref && typeof pref.email === "string" ? pref.email : "",
    timeZone: "time_zone" in pref && typeof pref.time_zone === "string" ? pref.time_zone : "UTC",
    enabled: "enabled" in pref && pref.enabled === true,
    confirmed: "verified_at" in pref && typeof pref.verified_at === "string",
    pending: "confirmation_expires_at" in pref && typeof pref.confirmation_expires_at === "string" && Date.parse(pref.confirmation_expires_at) > Date.now() };
}
function appOrigin(config: Config) {
  const url = new URL(config.APP_ORIGIN || "");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
    throw Error("Invalid app origin");
  return url.origin;
}
function landing(title: string, text: string, action?: "confirm" | "unsubscribe", token = "") {
  // All content is fixed copy; the only interpolated input is a validated hex token.
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Day reminders</title>
<style>body{margin:0;padding:32px 16px;background:#e9eee9;color:#243d38;font:20px/1.5 system-ui}main{max-width:520px;margin:24px auto;padding:28px;border:1px solid #dce4d9;border-radius:18px;background:#fffefa}h1{font-size:28px}button,a{display:block;box-sizing:border-box;width:100%;padding:14px;border:0;border-radius:12px;background:#356c48;color:white;font:inherit;text-align:center;text-decoration:none}button{cursor:pointer}</style>
<main><h1>${title}</h1><p>${text}</p>${action ? `<form method="post" action="/api/reminders"><input type="hidden" name="action" value="${action}"><input type="hidden" name="token" value="${token}"><button>${action === "confirm" ? "Confirm email reminders" : "Turn off reminders"}</button></form>` : '<a href="/">Open My Day</a>'}</main></html>`;
}

export function remindersMiddleware(config: Config, fetcher: typeof fetch = fetch) {
  const publicClient = () => createClient(config.SUPABASE_URL || cloudConfig.url,
    config.SUPABASE_PUBLISHABLE_KEY || cloudConfig.publishableKey, options);
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: ((input, init) => fetcher(input, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) })) as typeof fetch } };
  const admin = () => createClient(config.SUPABASE_URL || cloudConfig.url,
    config.SUPABASE_SECRET_KEY || config.SUPABASE_SERVICE_ROLE_KEY || "", options);
  const adminConfigured = () => Boolean(config.SUPABASE_SECRET_KEY || config.SUPABASE_SERVICE_ROLE_KEY);
  const configured = () => Boolean(config.RESEND_API_KEY && config.REPORT_FROM && config.APP_ORIGIN && (config.CRON_SECRET?.trim().length ?? 0) >= 32 && adminConfigured());

  return async (req: IncomingMessage & { body?: unknown }, res: ServerResponse, next: () => void) => {
    if (req.url?.split("?")[0] !== "/api/reminders") return next();
    const url = new URL(req.url, "http://request.local");
    const reply = (status: number, body: object | string) => {
      res.writeHead(status, { "Content-Type": typeof body === "string" ? "text/html; charset=utf-8" : "application/json",
        "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
        ...(typeof body === "string" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } : {}) });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    if (!["GET", "POST"].includes(req.method || "")) return reply(405, { error: "Use reminder settings in My Day." });
    let body: unknown;
    try {
      if (req.method === "POST") {
        if (!req.headers["content-type"]?.startsWith("application/json") &&
          !req.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) return reply(415, { error: "Invalid request." });
        let raw = "";
        if (req.body !== undefined) body = typeof req.body === "string"
          ? req.headers["content-type"]?.startsWith("application/json") ? JSON.parse(req.body) : Object.fromEntries(new URLSearchParams(req.body))
          : req.body;
        else {
          for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) return reply(413, { error: "Request too large." }); }
          if (req.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) body = Object.fromEntries(new URLSearchParams(raw));
          else if (req.headers["content-type"]?.startsWith("application/json")) body = JSON.parse(raw);
          else return reply(415, { error: "Invalid request." });
        }
        if (Buffer.byteLength(JSON.stringify(body)) > 4096) return reply(413, { error: "Request too large." });
      }
    } catch { return reply(400, { error: "Could not read that request." }); }
    const action = req.method === "GET" ? url.searchParams.get("action")
      : body && typeof body === "object" && "action" in body ? body.action : null;

    if (action === "confirm" || action === "unsubscribe") {
      const token = req.method === "GET" ? url.searchParams.get("token")
        : body && typeof body === "object" && "token" in body ? body.token : null;
      if (!isToken(token)) return reply(400, landing("Link unavailable", "Please open a new link from your email or update reminders in Settings."));
      if (req.method === "GET") return reply(200, landing(action === "confirm" ? "Confirm your email" : "Turn off email reminders?",
        action === "confirm" ? "Get a reminder at 4 PM in your time zone if you have not logged an activity today. You can turn reminders off at any time."
          : "You will no longer receive the daily activity reminder.", action, token));
      if (!adminConfigured()) return reply(503, landing("Reminders unavailable", "Please try again later."));
      try {
        const { data, error } = await admin().rpc(action === "confirm" ? "confirm_activity_reminder" : "unsubscribe_activity_reminder",
          action === "confirm" ? { token_hash: hash(token) } : { token });
        if (error) throw error;
        if (!data) return reply(400, landing("Link unavailable", "This link has expired or has already been used. Please update reminders in Settings."));
        return reply(200, landing(action === "confirm" ? "Email reminders are on" : "Email reminders are off",
          action === "confirm" ? "We will remind you at 4 PM if you have not logged an activity. You can change this in Settings." : "You can turn them on again in Settings."));
      } catch { return reply(503, landing("Could not update reminders", "Please try again later.")); }
    }

    if (action === "run") {
      if (req.method !== "POST") return reply(405, { error: "Use POST." });
      const expected = config.CRON_SECRET?.trim();
      if (!expected || expected.length < 32 || !timingSafeEqual(Buffer.from(hash(req.headers.authorization || "")), Buffer.from(hash(`Bearer ${expected}`))))
        return reply(401, { error: "Not authorized." });
      if (!configured()) return reply(503, { error: "Reminder service needs setup." });
      try {
        const origin = appOrigin(config);
        const client = admin();
        const { data: jobs, error } = await client.rpc("claim_activity_reminders");
        if (error || !Array.isArray(jobs)) throw Error("Could not claim reminders");
        let accepted = 0, failed = 0, skipped = 0;
        // ponytail: ten messages per tick; raise the batch/worker budget for a larger rollout.
        for (const job of jobs) {
          if (!job || typeof job !== "object" || typeof job.user_id !== "string" || typeof job.local_date !== "string" ||
            typeof job.email !== "string" || !validReminderEmail(job.email) || !isToken(job.unsubscribe_token) || typeof job.claim_id !== "string") {
            failed++; continue;
          }
          if (accepted + failed > 0) await new Promise((resolve) => setTimeout(resolve, 600));
          try {
            const current = await client.rpc("activity_reminder_still_due", { delivery_claim: job.claim_id });
            if (current.error) throw current.error;
            if (current.data !== true) { skipped++; continue; }
            const id = await sendResend(config, { to: job.email, subject: "A reminder from My Day",
              text: `A quick reminder to log an activity today.\n\nOpen My Day: ${origin}/\n\nTurn off reminders: ${origin}/api/reminders?action=unsubscribe&token=${job.unsubscribe_token}` },
            fetcher, `activity-reminder/${hash(`${job.user_id}/${job.local_date}`)}`, 8000);
            const finished = await client.rpc("finish_activity_reminder", { delivery_claim: job.claim_id, email_id: id });
            if (finished.error) throw finished.error;
            accepted++;
          } catch { failed++; }
        }
        return reply(failed ? 502 : 200, { accepted, failed, skipped });
      } catch { return reply(503, { error: "Could not check reminders. The scheduler can retry." }); }
    }

    const token = /^Bearer (\S+)$/.exec(req.headers.authorization || "")?.[1];
    if (!token) return reply(401, { error: "Sign in to manage reminders." });
    let userId: string;
    try {
      const { data, error } = await publicClient().auth.getUser(token);
      if (error || !data.user) return reply(401, { error: "Sign in again to manage reminders." });
      userId = data.user.id;
    } catch { return reply(503, { error: "Could not check your account." }); }
    if (!adminConfigured()) return reply(req.method === "GET" ? 200 : 503,
      { available: false, preferences: summary(null), error: "Email reminders need setup." });
    try {
      const client = admin();
      if (req.method === "POST") {
        try { if (new URL(req.headers.origin || "").host !== req.headers.host) throw Error(); }
        catch { return reply(403, { error: "Update reminders from this app." }); }
        if (action !== "save" || !body || typeof body !== "object" || !("enabled" in body) || typeof body.enabled !== "boolean")
          return reply(400, { error: "Choose a reminder preference." });
        if (!body.enabled) {
          const result = await client.rpc("disable_activity_reminder", { owner_id: userId });
          if (result.error) throw result.error;
        } else {
          if (!configured()) return reply(503, { error: "Email reminders need setup." });
          appOrigin(config);
          if (!("email" in body) || typeof body.email !== "string" || !validReminderEmail(body.email.trim()) ||
            !("timeZone" in body) || typeof body.timeZone !== "string" || !validTimeZone(body.timeZone) ||
            !("consent" in body) || body.consent !== true) return reply(400, { error: "Enter your email, time zone, and permission to receive reminders." });
          const confirmation = randomBytes(32).toString("hex");
          const result = await client.rpc("request_activity_reminder", { owner_id: userId, recipient: body.email.trim().toLowerCase(),
            zone: body.timeZone, token_hash: hash(confirmation) });
          if (result.error?.message.includes("RATE_LIMITED")) return reply(429, { error: "Please wait a minute before requesting another confirmation." });
          if (result.error) throw result.error;
          if (result.data === true) {
            try { await sendResend(config, { to: body.email.trim().toLowerCase(), subject: "Confirm your My Day email reminders",
              text: `Confirm that you want an activity reminder at 4 PM if you have not logged an activity that day.\n\n${appOrigin(config)}/api/reminders?action=confirm&token=${confirmation}\n\nThis link expires in 24 hours. If you did not request reminders, ignore this email.` }, fetcher, undefined, 8000); }
            catch { return reply(502, { error: "Could not send your confirmation email. Please try again in a minute." }); }
          }
        }
      }
      const result = await client.from("activity_reminder_preferences").select(preferenceColumns).eq("user_id", userId).maybeSingle();
      if (result.error) throw result.error;
      return reply(200, { available: configured(), preferences: summary(result.data) });
    } catch { return reply(503, { error: "Could not update reminder settings. Please try again." }); }
  };
}
