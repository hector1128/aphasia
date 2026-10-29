import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { reportMiddleware } from "../server/report-api";
import { emptyData } from "./model";

async function reportServer(fetcher: typeof fetch, config: Record<string, string> = { RESEND_API_KEY: "synthetic-resend-key", REPORT_FROM: "reports@example.com", REPORT_REPLY_TO: "lab@example.edu" }) {
  const middleware = reportMiddleware(config, undefined, fetcher);
  const server = createServer((req, res) => void middleware(req, res, () => res.end()));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    send: (period = "day") => fetch(`${origin}/api/report`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ to: "recipient@example.com", date: "2026-10-25", period, data: { ...emptyData(), name: "Synthetic account" } }),
    }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("Resend accepts daily and weekly reports with real base64 PDF attachments and a cooldown", async () => {
  for (const period of ["day", "week"]) {
    let calls = 0;
    const api = await reportServer(async (url, init) => {
      calls++;
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer synthetic-resend-key");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.from, "reports@example.com");
      assert.equal(body.reply_to, "lab@example.edu");
      assert.deepEqual(body.to, ["recipient@example.com"]);
      assert.equal(body.attachments[0].filename, `my-day-${period}-2026-10-25.pdf`);
      const pdf = Buffer.from(body.attachments[0].content, "base64");
      assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
      assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
      return Response.json({ id: "synthetic-email-id" });
    });
    try {
      const response = await api.send(period);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { accepted: true });
      assert.equal((await api.send(period)).status, 429);
      assert.equal(calls, 1);
    } finally { await api.close(); }
  }
});

test("provider errors, malformed success, and timeout never claim delivery or expose credentials", async () => {
  for (const response of [Response.json({ message: "private provider details" }, { status: 403 }),
    Response.json({}), new Response("not JSON", { status: 502 }), null]) {
    const api = await reportServer(async () => {
      if (!response) throw new DOMException("private provider details", "TimeoutError");
      return response;
    });
    try {
      const result = await api.send();
      assert.equal(result.status, 502);
      const body = await result.text();
      assert.doesNotMatch(body, /private provider details|synthetic-resend-key/);
      assert.match(body, /download the PDF/);
    } finally { await api.close(); }
  }
});

test("missing Resend sender fails before contacting the email provider", async () => {
  let calls = 0;
  const api = await reportServer(async () => { calls++; return Response.json({ id: "should-not-send" }); },
    { RESEND_API_KEY: "synthetic-resend-key", REPORT_FROM: "" });
  try {
    assert.equal((await api.send()).status, 503);
    assert.equal(calls, 0);
  } finally { await api.close(); }
});
