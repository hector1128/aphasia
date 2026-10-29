type EmailConfig = Record<string, string | undefined>;
export type EmailMessage = { to: string; subject: string; text: string;
  attachments?: { filename: string; content: string }[] };

export async function sendResend(config: EmailConfig, message: EmailMessage,
  fetcher: typeof fetch = fetch, idempotencyKey?: string, timeoutMs = 20000) {
  if (!config.RESEND_API_KEY || !config.REPORT_FROM) throw Error("Email is not configured");
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${config.RESEND_API_KEY.trim()}`, "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from: config.REPORT_FROM, to: [message.to],
      ...(config.REPORT_REPLY_TO ? { reply_to: config.REPORT_REPLY_TO } : {}),
      subject: message.subject, text: message.text, ...(message.attachments ? { attachments: message.attachments } : {}) }),
  });
  const result: unknown = await response.json();
  if (!response.ok || !result || typeof result !== "object" || !("id" in result) ||
    typeof result.id !== "string" || !result.id.trim()) throw Error("Email not accepted");
  return result.id;
}
