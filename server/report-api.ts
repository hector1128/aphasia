import type { IncomingMessage, ServerResponse } from "node:http";
import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";
import { readData, dateKey } from "../src/model.js";
import { buildReportPdf } from "../src/report.js";
import { reportData } from "../src/report-data.js";
import { weeklyReportData } from "../src/weekly.js";
import { buildWeeklyReportPdf } from "../src/report-week.js";
import { cloudConfig } from "../src/cloud-config.js";
import { createClient } from "@supabase/supabase-js";
export type MailConfig = Record<string, string>;
export function validateRequest(body: unknown) {
  const b = body as { to: string; date: string; period?: unknown; data: unknown };
  if (
    !b ||
    typeof b.to !== "string" ||
    !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(b.to) ||
    b.to.length > 254 ||
    (b.period !== undefined && b.period !== "day" && b.period !== "week") ||
    typeof b.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
    dateKey(new Date(`${b.date}T12:00`)) !== b.date
  )
    throw Error("Enter a valid email and report date.");
  const data = readData(JSON.stringify(b.data));
  if (
    !data.name ||
    data.name.length > 100 ||
    Object.keys(data.entries).length > 1000 ||
    data.values.length > 100 ||
    data.values.some(
      (v) =>
        v.name.length > 200 ||
        v.activities.length > 200 ||
        v.activities.some((a) => a.name.length > 200),
    ) ||
    Object.values(data.entries).some((e) => e.name.length > 200)
  )
    throw Error("Invalid report data.");
  const period = b.period === "week" ? "week" : "day";
  return { to: b.to, date: b.date, period, data: period === "week" ? weeklyReportData(data, b.date) : reportData(data, b.date) };
}
export function reportMiddleware(
  config: MailConfig,
  sendMail?: (message: SendMailOptions) => Promise<{ accepted?: unknown[]; rejected?: unknown[] }>,
  fetcher: typeof fetch = fetch,
) {
  let sending = false,
    lastSend = 0;
  return async (
    req: IncomingMessage & { body?: unknown },
    res: ServerResponse,
    next: () => void,
  ) => {
    if (req.url !== "/api/report") return next();
    const reply = (status: number, body: object) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST")
      return reply(405, { error: "Use Send today's report in Settings." });
    // Hosted requests need an account; localhost also supports SMTP setup tests.
    const remote = req.socket.remoteAddress ?? "";
    const origin = req.headers.origin;
    let originUrl: URL;
    try {
      originUrl = new URL(origin || "");
    } catch {
      return reply(403, { error: "Invalid origin." });
    }
    if (
      !origin ||
      originUrl.host !== req.headers.host
    )
      return reply(403, {
        error: "Send reports from this app.",
      });
    const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname);
    const supabaseUrl = config.SUPABASE_URL || cloudConfig.url;
    const supabaseKey = config.SUPABASE_PUBLISHABLE_KEY || cloudConfig.publishableKey;
    if (!local && supabaseUrl && supabaseKey) {
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (!token) return reply(401, { error: "Sign in to send your report." });
      const client = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
      });
      try {
        const { data: user, error } = await client.auth.getUser(token);
        if (error || !user.user) return reply(401, { error: "Sign in again to send your report." });
        const { error: rateError } = await client.rpc("claim_report_slot");
        if (rateError) return reply(429, { error: "Please wait a minute before sending again." });
      } catch { return reply(503, { error: "Could not check your account. Please try again." }); }
    } else if (!local) return reply(403, { error: "Email service needs account configuration." });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return reply(415, { error: "Invalid request." });
    if (sending || Date.now() - lastSend < 10000)
      return reply(429, {
        error: "Please wait a few seconds before sending again.",
      });
    if (
      !sendMail &&
      !(config.RESEND_API_KEY && config.REPORT_FROM) && !(
        config.SMTP_HOST &&
        config.SMTP_USER &&
        config.SMTP_PASS &&
        config.REPORT_FROM
      )
    )
      return reply(503, {
        error: "Email sending needs setup. You can download the PDF now.",
      });
    sending = true;
    try {
      // Vercel parses JSON into req.body; Vite supplies the original Node stream.
      // https://vercel.com/docs/functions/runtimes/node-js
      let raw = req.body === undefined ? "" : JSON.stringify(req.body);
      if (req.body === undefined) {
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 1000000) break;
        }
      }
      if (Buffer.byteLength(raw) > 1000000) return reply(413, { error: "Report is too large." });
      let input;
      try {
        input = validateRequest(JSON.parse(raw));
      } catch {
        return reply(400, { error: "Enter a valid email and report details." });
      }
      const pdf = input.period === "week" ? await buildWeeklyReportPdf(input.data, input.date) : await buildReportPdf(input.data, input.date);
      const message = {
        from: config.REPORT_FROM,
        to: input.to,
        subject: `My Day ${input.period === "week" ? "weekly" : "daily"} report - ${input.date}`,
        text: `The ${input.period === "week" ? "weekly" : "daily"} report for ${input.date} is attached as a PDF. Missing information is marked in the report.`,
        attachments: [{ filename: `my-day-${input.period}-${input.date}.pdf`,
          content: Buffer.from(pdf), contentType: "application/pdf" }],
      } satisfies SendMailOptions;
      if (!sendMail && config.RESEND_API_KEY) {
        const response = await fetcher("https://api.resend.com/emails", {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
          headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, text: message.text,
            attachments: message.attachments.map((attachment) => ({ filename: attachment.filename,
              content: attachment.content.toString("base64") })) }),
        });
        const result: unknown = await response.json();
        if (!response.ok || !result || typeof result !== "object" || !("id" in result) ||
            typeof result.id !== "string" || !result.id.trim()) throw Error("Email not accepted");
      } else {
        const transport = sendMail ? null : nodemailer.createTransport({
            host: config.SMTP_HOST,
            port: Number(config.SMTP_PORT || 587),
            secure: config.SMTP_SECURE === "true",
            requireTLS: config.SMTP_SECURE !== "true",
            auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
            connectionTimeout: 15000,
            socketTimeout: 20000,
            disableFileAccess: true,
            disableUrlAccess: true,
          });
        const result = await (sendMail ?? transport!.sendMail.bind(transport))(message);
        if (result.rejected?.length || !result.accepted?.length) throw Error("Recipient not accepted");
      }
      lastSend = Date.now();
      reply(200, { accepted: true });
    } catch {
      reply(502, {
        error:
          "The email service could not confirm delivery. Check its configuration before retrying. You can download the PDF.",
      });
    } finally {
      sending = false;
    }
  };
}
