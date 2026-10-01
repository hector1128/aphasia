import type { IncomingMessage, ServerResponse } from "node:http";
import nodemailer from "nodemailer";
import { readData, dateKey } from "../src/model";
import { buildReportPdf } from "../src/report";
import { reportData } from "../src/report-data";
export type MailConfig = Record<string, string>;
export function validateRequest(body: unknown) {
  const b = body as { to: string; date: string; data: unknown };
  if (
    !b ||
    typeof b.to !== "string" ||
    !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(b.to) ||
    b.to.length > 254 ||
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
  return { to: b.to, date: b.date, data: reportData(data, b.date) };
}
export function reportMiddleware(
  config: MailConfig,
  sendMail?: (message: any) => Promise<any>,
) {
  let sending = false,
    lastSend = 0;
  return async (
    req: IncomingMessage,
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
    // Local prototype only: no anonymous public email relay or cross-origin requests.
    const remote = req.socket.remoteAddress ?? "";
    const origin = req.headers.origin;
    let originUrl: URL;
    try {
      originUrl = new URL(origin || "");
    } catch {
      return reply(403, { error: "Invalid origin." });
    }
    if (
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote) ||
      !origin ||
      !["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname) ||
      originUrl.host !== req.headers.host
    )
      return reply(403, {
        error: "Send reports from this computer's localhost app.",
      });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return reply(415, { error: "Invalid request." });
    if (sending || Date.now() - lastSend < 10000)
      return reply(429, {
        error: "Please wait a few seconds before sending again.",
      });
    if (
      !sendMail &&
      !(
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
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 1000000) {
          reply(413, { error: "Report is too large." });
          return;
        }
      }
      let input;
      try {
        input = validateRequest(JSON.parse(raw));
      } catch {
        return reply(400, { error: "Enter a valid email and report details." });
      }
      const pdf = await buildReportPdf(input.data, input.date);
      const transport = sendMail
        ? null
        : nodemailer.createTransport({
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
      const result = await (sendMail ?? transport!.sendMail.bind(transport))({
        from: config.REPORT_FROM,
        to: input.to,
        subject: `My Day report - ${input.date}`,
        text: `The daily prototype report for ${input.date} is attached as a PDF. Missing information is marked Not completed.`,
        attachments: [
          {
            filename: `my-day-${input.date}.pdf`,
            content: Buffer.from(pdf),
            contentType: "application/pdf",
          },
        ],
      });
      if (result.rejected?.length || !result.accepted?.length)
        throw Error("Recipient not accepted");
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
