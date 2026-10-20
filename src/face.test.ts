import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { faceMiddleware } from "../server/face-api";
import { createFaceSession } from "../server/face-session";
import { signFaceCapture, faceCaptureMessage } from "./face-device";

const user = "00000000-0000-4000-8000-000000000001";
const otherUser = "00000000-0000-4000-8000-000000000002";
const config = { FACE_PROTOTYPE_ENABLED: "true", FACE_APP_ORIGIN: "http://localhost:5173",
  FACE_SERVICE_URL: "http://127.0.0.1:8001", FACE_SERVICE_SECRET: "test-secret-with-at-least-32-characters" };

async function gateway(options: Parameters<typeof faceMiddleware>[1] = {}, settings: Record<string, string> = config, path = "/api/face") {
  const handler = faceMiddleware(settings, options);
  const server = createServer((req, res) => void handler(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No server address");
  return {
    request: async (body: object, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: config.FACE_APP_ORIGIN, Authorization: "Bearer test-token", ...headers },
      body: JSON.stringify(body),
    }),
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("face gateway rejects unauthenticated, cross-origin, and oversized requests without inference", async () => {
  let calls = 0;
  const api = await gateway({ authenticate: async () => null, fetch: async () => { calls++; throw Error(); } });
  try {
    for (const action of ["status", "enroll", "register", "verify", "remove"])
      assert.equal((await api.request({ action })).status, 401);
    assert.equal((await api.request({ action: "status" }, { Origin: "https://other.example" })).status, 403);
    assert.equal((await api.request({ action: "enroll", frames: ["x".repeat(1000001)] })).status, 413);
    assert.equal(calls, 0);
  } finally { await api.close(); }
});

test("face gateway hides the feature when globally disabled", async () => {
  const disabled = await gateway({}, { ...config, FACE_PROTOTYPE_ENABLED: "false" });
  try {
    assert.deepEqual(await (await disabled.request({ action: "status" })).json(), { available: false, enrolled: false, registered: false });
    assert.equal((await disabled.request({ action: "begin" })).status, 503);
  } finally { await disabled.close(); }
});

test("any authenticated account can enroll without manual approval, including with obsolete allowlist settings", async () => {
  for (const id of [user, otherUser]) {
    const api = await gateway({ authenticate: async () => ({ id, recentPassword: true }), fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.userId, id);
      return Response.json(body.action === "status" ? { enrolled: false, registered: false } : { ok: true });
    } }, { ...config, FACE_TEST_USER_IDS: user });
    try {
      assert.equal((await (await api.request({ action: "status" })).json()).available, true);
      assert.deepEqual(await (await api.request({ action: "enroll", userId: "another-account" })).json(), { ok: true });
    } finally { await api.close(); }
  }
});

test("enrollment and browser registration require recent password authentication; verification does not", async () => {
  let calls = 0;
  const api = await gateway({ authenticate: async () => ({ id: user, recentPassword: false }), fetch: async () => {
    calls++; return Response.json({ verified: true, access_token: "must-not-leak", template: "private" });
  } });
  try {
    assert.equal((await api.request({ action: "begin", operation: "enroll" })).status, 401);
    assert.equal((await api.request({ action: "enroll" })).status, 401);
    assert.equal((await api.request({ action: "begin", operation: "register" })).status, 401);
    assert.equal((await api.request({ action: "register" })).status, 401);
    assert.deepEqual(await (await api.request({ action: "verify" })).json(), { verified: true });
    assert.equal(calls, 1);
  } finally { await api.close(); }
});

test("browser registration uses the authenticated account and returns no private data or session", async () => {
  const api = await gateway({ authenticate: async () => ({ id: user, recentPassword: true }), fetch: async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.userId, user);
    assert.equal(body.action, "register");
    return Response.json({ ok: true, template: "private", access_token: "must-not-leak" });
  } });
  try {
    assert.deepEqual(await (await api.request({ action: "register", userId: "wrong-account" })).json(), { ok: true });
  } finally { await api.close(); }
});

test("gateway uses authenticated identity, authenticates upstream, and limits returned fields", async () => {
  const api = await gateway({ authenticate: async () => ({ id: user, recentPassword: true }), fetch: async (input, init) => {
    assert.equal(String(input), "http://127.0.0.1:8001/v1/face");
    assert.equal(JSON.parse(String(init?.body)).userId, user);
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${config.FACE_SERVICE_SECRET}`);
    return Response.json({ enrolled: true, registered: true, template: "private", score: 0.99 });
  } });
  try {
    assert.deepEqual(await (await api.request({ action: "status", userId: "victim" })).json(), { available: true, enrolled: true, registered: true, signInAvailable: false });
  } finally { await api.close(); }
});

const deviceId = "00000000-0000-4000-8000-000000000003";
const loginConfig = { ...config, FACE_SIGNIN_ENABLED: "true", SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key" };

test("face sign-in remains disabled until the flag and private admin credential are configured", async () => {
  const api = await gateway({}, { ...loginConfig, SUPABASE_SERVICE_ROLE_KEY: "" }, "/api/face-login");
  try {
    assert.deepEqual(await (await api.request({ action: "config", userId: user })).json(), { available: false });
    assert.equal((await api.request({ action: "login", userId: user, deviceId })).status, 503);
  } finally { await api.close(); }
});

test("face sign-in availability applies to all valid account UUIDs without exposing enrollment status", async () => {
  let calls = 0;
  const api = await gateway({ fetch: async () => { calls++; throw Error(); } }, loginConfig, "/api/face-login");
  try {
    for (const id of [user, otherUser])
      assert.deepEqual(await (await api.request({ action: "config", userId: id })).json(), { available: true });
    for (const id of ["", "someone-else", "x".repeat(100), null])
      assert.deepEqual(await (await api.request({ action: "config", userId: id })).json(), { available: false });
    assert.equal((await api.request({ action: "login", userId: user, deviceId: "-".repeat(36) })).status, 400);
    assert.equal(calls, 0);
  } finally { await api.close(); }
});

test("public face sign-in rejects setup actions, malformed identities, and unbound verification results", async () => {
  let sessions = 0, calls = 0;
  const api = await gateway({ createSession: async () => { sessions++; throw Error(); }, fetch: async (_input, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.operation, "login");
    return Response.json(body.action === "begin" ? { challengeId: deviceId, message: "login-challenge" } : { verified: true });
  } }, loginConfig, "/api/face-login");
  try {
    assert.equal((await api.request({ action: "enroll", userId: user, deviceId })).status, 400);
    assert.equal((await api.request({ action: "register", userId: user, deviceId })).status, 400);
    assert.equal((await api.request({ action: "login", userId: "someone-else", deviceId })).status, 400);
    assert.equal((await api.request({ action: "begin", userId: user, deviceId, operation: "enroll" })).status, 200);
    // A verified boolean without a bound account identity can never mint a session.
    assert.equal((await api.request({ action: "login", userId: user, deviceId, verified: true })).status, 503);
    assert.equal(calls, 2); assert.equal(sessions, 0);
  } finally { await api.close(); }
});

test("only a successful account-bound login proof can create a normal user session", async () => {
  for (const accountId of [user, otherUser]) {
    let sessions = 0;
    const api = await gateway({ fetch: async () => Response.json({ verified: true, userId: accountId, template: "private" }),
      createSession: async (id) => {
        assert.equal(id, accountId); sessions++;
        return { userId: id, access_token: "user-access", refresh_token: "user-refresh" };
      } }, loginConfig, "/api/face-login");
    try {
      const response = await api.request({ action: "login", userId: accountId, deviceId });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { userId: accountId, access_token: "user-access", refresh_token: "user-refresh" });
      assert.equal(sessions, 1);
    } finally { await api.close(); }
  }
});

test("failed or mismatched private proofs never invoke the Supabase session bridge", async () => {
  for (const result of [{ verified: false, userId: user }, { verified: true, userId: otherUser }]) {
    let sessions = 0;
    const api = await gateway({ fetch: async () => Response.json(result), createSession: async () => { sessions++; throw Error(); } }, loginConfig, "/api/face-login");
    try {
      assert.equal((await api.request({ action: "login", userId: user, deviceId })).status, 503);
      assert.equal(sessions, 0);
    } finally { await api.close(); }
  }
});

test("Supabase bridge keeps the generated token server-side and verifies the exact user identity", async () => {
  const calls: string[] = [];
  const account = { id: user, email: "internal@accounts.myday.invalid", email_confirmed_at: "2026-10-01T00:00:00Z", factors: [] };
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    if (url.endsWith(`/admin/users/${user}`)) return Response.json(account);
    if (url.endsWith("/admin/generate_link")) {
      assert.deepEqual(JSON.parse(String(init?.body)), { type: "magiclink", email: account.email });
      return Response.json({ ...account, hashed_token: "server-only-one-time-proof", verification_type: "magiclink" });
    }
    assert.ok(url.endsWith("/verify"));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.type, "email");
    assert.equal(body.token_hash, "server-only-one-time-proof");
    const headers = new Headers(init?.headers);
    assert.notEqual(headers.get("authorization"), `Bearer ${loginConfig.SUPABASE_SERVICE_ROLE_KEY}`);
    return Response.json({ access_token: "user-token", refresh_token: "refresh-token", token_type: "bearer", expires_in: 3600, user: account });
  };
  assert.deepEqual(await createFaceSession({ ...loginConfig, SUPABASE_URL: "https://project.example" }, user, fetcher),
    { userId: user, access_token: "user-token", refresh_token: "refresh-token" });
  assert.equal(calls.length, 3);
});

test("Supabase bridge rejects an unexpected account and accounts with verified MFA", async () => {
  for (const account of [
    { id: "wrong-user", email: "account@example.com", email_confirmed_at: "2026-10-01" },
    { id: user, email: "account@example.com", email_confirmed_at: "2026-10-01", factors: [{ status: "verified" }] },
  ]) {
    let calls = 0;
    await assert.rejects(createFaceSession({ ...loginConfig, SUPABASE_URL: "https://project.example" }, user, async () => {
      calls++; return Response.json(account);
    }));
    assert.equal(calls, 1);
  }
});

test("Supabase bridge rejects identity changes during token generation or verification", async () => {
  const account = { id: user, email: "internal@accounts.myday.invalid", email_confirmed_at: "2026-10-01" };
  for (const mismatch of ["generation", "verification"]) {
    let verified = false, revoked = false;
    await assert.rejects(createFaceSession({ ...loginConfig, SUPABASE_URL: "https://project.example" }, user, async (input, init) => {
      const url = String(input);
      if (url.endsWith(`/admin/users/${user}`)) return Response.json(account);
      if (url.endsWith("/admin/generate_link")) return Response.json({
        ...account, id: mismatch === "generation" ? "wrong-user" : user,
        hashed_token: "server-only-proof", verification_type: "magiclink",
      });
      if (url.endsWith("/verify")) {
        verified = true;
        return Response.json({ access_token: "wrong-user-token", refresh_token: "wrong-user-refresh", token_type: "bearer",
          expires_in: 3600, user: { ...account, id: "wrong-user" } });
      }
      assert.ok(url.includes("/logout"));
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer wrong-user-token");
      revoked = true;
      return new Response(null, { status: 204 });
    }));
    assert.equal(verified, mismatch === "verification");
    assert.equal(revoked, mismatch === "verification");
  }
});

test("upstream failures cannot disclose internals; remote service must use TLS", async () => {
  let calls = 0;
  const unavailable = await gateway({ authenticate: async () => ({ id: user, recentPassword: true }),
    fetch: async () => Response.json({ code: "constructor", error: "secret trace" }, { status: 500 }) });
  const insecure = await gateway({ authenticate: async () => ({ id: user, recentPassword: true }), fetch: async () => {
    calls++; throw Error();
  } }, { ...config, FACE_SERVICE_URL: "http://remote.example" });
  try {
    const response = await unavailable.request({ action: "verify" });
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /secret|constructor/);
    assert.equal((await insecure.request({ action: "verify" })).status, 503);
    assert.equal(calls, 0);
  } finally { await unavailable.close(); await insecure.close(); }
});

test("device signature binds the server challenge and exact ordered capture bytes", async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const device = { id: crypto.randomUUID(), privateKey: pair.privateKey, publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey) };
  assert.equal(device.privateKey.extractable, false);
  const frames = [btoa("one"), btoa("two"), btoa("three")];
  const signature = Uint8Array.from(atob(await signFaceCapture(device, "challenge", frames)), (char) => char.charCodeAt(0));
  assert.equal(signature.length, 64);
  const hashes = await Promise.all(["one", "two", "three"].map(async (frame) => Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(frame))).toString("hex")));
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, signature,
    new TextEncoder().encode(faceCaptureMessage("challenge", hashes))), true);
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, signature,
    new TextEncoder().encode(faceCaptureMessage("another-challenge", hashes))), false);
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, signature,
    new TextEncoder().encode(faceCaptureMessage("challenge", [...hashes].reverse()))), false);
});
