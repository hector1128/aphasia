export function twilioConfig(env: Record<string, string | undefined>) {
  const account = env.TWILIO_ACCOUNT_SID?.trim();
  const key = env.TWILIO_API_KEY_SID?.trim();
  const secret = env.TWILIO_API_KEY_SECRET?.trim();
  const service = env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (!account || !/^AC[a-f0-9]{32}$/i.test(account) || !key || !/^SK[a-f0-9]{32}$/i.test(key) ||
      !secret || !service || !/^MG[a-f0-9]{32}$/i.test(service)) return null;
  return { account, key, secret, service };
}

export async function sendText(
  config: NonNullable<ReturnType<typeof twilioConfig>>, to: string, body: string, fetcher: typeof fetch,
) {
  const response = await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${config.account}/Messages.json`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Basic ${Buffer.from(`${config.key}:${config.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, MessagingServiceSid: config.service, Body: body }),
  });
  const result: unknown = await response.json();
  if (result && typeof result === "object") {
    if (("code" in result && result.code === 21610) || ("error_code" in result && result.error_code === 21610)) return null;
    if (response.ok && "sid" in result && typeof result.sid === "string" && /^SM[a-f0-9]{32}$/i.test(result.sid) &&
        "status" in result && ["accepted", "queued", "sending", "sent", "delivered"].some((status) => status === result.status)) return result.sid;
  }
  throw Error("Text not accepted");
}
