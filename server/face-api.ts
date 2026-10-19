import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { cloudConfig } from "../src/cloud-config.js";
import { createFaceSession, type FaceSession } from "./face-session.js";

type Config = Record<string, string | undefined>;
type Identity = { id: string; recentPassword: boolean };
type Authenticate = (token: string) => Promise<Identity | null>;
const actions = new Set(["status", "begin", "enroll", "register", "verify", "remove"]);
const messages: Record<string, string> = {
  invalid: "Could not read that request. Please try again.",
  expired: "That check has expired. Please try again.",
  device: "This browser is not set up. Please set up face verification again.",
  capture: "Could not check your face. Use good light and keep just your face in view.",
  mismatch: "Your face was not confirmed. You can try again or keep using your password.",
  limited: "Please wait a minute before trying again.",
  unavailable: "Face verification is unavailable. You can keep using your password.",
};

export function faceMiddleware(config: Config, overrides: {
  authenticate?: Authenticate; fetch?: typeof fetch; createSession?: (userId: string) => Promise<FaceSession>;
} = {}) {
  const signInConfigured = () => config.FACE_SIGNIN_ENABLED === "true" && Boolean(config.SUPABASE_SECRET_KEY || config.SUPABASE_SERVICE_ROLE_KEY);
  const authenticate: Authenticate = overrides.authenticate ?? (async (token) => {
    const client = createClient(config.SUPABASE_URL || cloudConfig.url,
      config.SUPABASE_PUBLISHABLE_KEY || cloudConfig.publishableKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    // Decode only AFTER Supabase has authenticated this exact token.
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as {
      sub?: string; amr?: { method: string; timestamp: number }[];
    };
    const now = Date.now() / 1000;
    return { id: data.user.id, recentPassword: claims.sub === data.user.id && Array.isArray(claims.amr) &&
      claims.amr.some((entry) => entry.method === "password" && Number.isFinite(entry.timestamp) &&
        entry.timestamp <= now + 30 && now - entry.timestamp < 300) };
  });
  return async (req: IncomingMessage & { body?: unknown }, res: ServerResponse, next: () => void) => {
    const login = req.url === "/api/face-login";
    if (req.url !== "/api/face" && !login) return next();
    const reply = (status: number, body: object) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST") return reply(405, { error: "Use face verification in Settings." });
    try {
      const origin = new URL(req.headers.origin || "");
      if (origin.origin !== config.FACE_APP_ORIGIN || !["https:", "http:"].includes(origin.protocol)) throw Error();
    } catch { return reply(403, { error: "Use face verification from this app." }); }
    if (!req.headers["content-type"]?.startsWith("application/json")) return reply(415, { error: messages.invalid });
    let body: Record<string, unknown>;
    try {
      let raw = req.body === undefined ? "" : JSON.stringify(req.body);
      if (req.body === undefined) for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 1000000) break;
      }
      if (Buffer.byteLength(raw) > 1000000) return reply(413, { error: "Camera images are too large. Please try again." });
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.action !== "string" ||
          !(login ? ["config", "begin", "login"].includes(body.action) : actions.has(body.action))) throw Error();
    } catch { return reply(400, { error: messages.invalid }); }
    const configured = config.FACE_PROTOTYPE_ENABLED === "true" && config.FACE_SERVICE_URL && config.FACE_SERVICE_SECRET;
    const testUsers = (config.FACE_TEST_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
    if (login && body.action === "config") return reply(200, { available: Boolean(configured && signInConfigured() &&
      typeof body.userId === "string" && testUsers.includes(body.userId)) });
    if (!configured || (login && !signInConfigured())) return body.action === "status"
      ? reply(200, { available: false, enrolled: false, registered: false })
      : reply(503, { error: messages.unavailable });
    let identity;
    if (login) {
      if (typeof body.userId !== "string" || !testUsers.includes(body.userId) ||
          typeof body.deviceId !== "string" || !/^[0-9a-f-]{36}$/.test(body.deviceId))
        return reply(400, { error: messages.device });
      identity = { id: body.userId, recentPassword: false };
      // An anonymous request may only request/complete a LOGIN challenge.
      body = { ...body, operation: "login" };
    } else try {
      const token = /^Bearer (\S+)$/.exec(req.headers.authorization || "")?.[1];
      identity = token ? await authenticate(token) : null;
    } catch { return reply(503, { error: messages.unavailable }); }
    if (!identity) return reply(401, { error: "Please sign in again." });
    if (!testUsers.includes(identity.id)) return body.action === "status"
      ? reply(200, { available: false, enrolled: false, registered: false })
      : reply(403, { error: "Face verification is available only to trial accounts." });
    if ((["enroll", "register"].includes(body.action as string) ||
        (body.action === "begin" && ["enroll", "register"].includes(body.operation as string))) && !identity.recentPassword)
      return reply(401, { error: "Enter your password again before setting up face verification." });
    try {
      const url = new URL(config.FACE_SERVICE_URL!);
      if (url.username || url.password || url.search || url.hash ||
          (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) throw Error();
      const response = await (overrides.fetch ?? fetch)(new URL("/v1/face", url), {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${config.FACE_SERVICE_SECRET}`, "Content-Type": "application/json" },
        // Protected actions use the authenticated account. Anonymous login uses
        // this ID only for lookup; the private service must prove it before sign-in.
        body: JSON.stringify({ ...body, userId: identity.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        const code = typeof result.code === "string" && Object.hasOwn(messages, result.code) ? result.code : "unavailable";
        return reply(code === "limited" ? 429 : code === "unavailable" ? 503 : 400, { error: messages[code] });
      }
      // Only the login branch below can return normal user session credentials.
      if (body.action === "status") return reply(200, { available: true, enrolled: result.enrolled === true, registered: result.registered === true,
        signInAvailable: signInConfigured() });
      if (body.action === "begin") {
        if (typeof result.challengeId !== "string" || typeof result.message !== "string" || result.message.length > 1000) throw Error();
        return reply(200, { challengeId: result.challengeId, message: result.message });
      }
      if (body.action === "verify") return reply(200, { verified: result.verified === true });
      if (login && body.action === "login") {
        if (result.verified !== true || result.userId !== identity.id) throw Error();
        const session = await (overrides.createSession ?? ((id) => createFaceSession(config, id)))(result.userId);
        if (session.userId !== identity.id || !session.access_token || !session.refresh_token) throw Error();
        return reply(200, session);
      }
      return reply(200, { ok: result.ok === true });
    } catch { return reply(503, { error: messages.unavailable }); }
  };
}
