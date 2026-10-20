import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { devOrigin, faceServiceReady } from "./dev.mjs";

test("development uses the configured face origin and requires a local address", () => {
  const config = { FACE_PROTOTYPE_ENABLED: "true", FACE_APP_ORIGIN: "http://127.0.0.1:5173" };
  assert.equal(devOrigin(config).origin, config.FACE_APP_ORIGIN);
  assert.equal(devOrigin({ ...config, FACE_APP_ORIGIN: "http://localhost:5180" }).origin, "http://localhost:5180");
  for (const address of ["https://app.example", "http://127.0.0.1:5173/path", "http://name:secret@localhost:5173", ""]) {
    assert.throws(() => devOrigin({ ...config, FACE_APP_ORIGIN: address }));
  }
  assert.equal(devOrigin({}).origin, "http://127.0.0.1:5173");
});

test("face service readiness checks are authenticated and do not enroll or capture", async () => {
  const url = new URL("http://127.0.0.1:8001");
  assert.equal(await faceServiceReady(url, "synthetic-secret", async (input, options) => {
    assert.equal(String(input), "http://127.0.0.1:8001/v1/face");
    assert.equal(options.headers.Authorization, "Bearer synthetic-secret");
    assert.deepEqual(JSON.parse(options.body), { action: "status", userId: "00000000-0000-0000-0000-000000000000" });
    return Response.json({ enrolled: false, registered: false });
  }), true);
});

test("a stopped service is retriable while a wrong secret or unrelated server is reported", async () => {
  const url = new URL("http://127.0.0.1:8001");
  const refused = Object.assign(Error("connect failed"), { cause: { code: "ECONNREFUSED" } });
  assert.equal(await faceServiceReady(url, "synthetic-secret", async () => { throw refused; }), false);
  await assert.rejects(faceServiceReady(url, "synthetic-secret", async () => Response.json({}, { status: 401 })), /FACE_SERVICE_SECRET/);
  await assert.rejects(faceServiceReady(url, "synthetic-secret", async () => new Response("unrelated server")), /private face service/);
});

test("the dev app reuses an existing face service and leaves it running on shutdown", { timeout: 20000 }, async () => {
  const secret = "synthetic-development-secret";
  let checks = 0;
  const face = createServer((req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${secret}`);
    checks++;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ enrolled: false, registered: false }));
  });
  const reservation = createServer();
  await new Promise((resolve) => face.listen(0, "127.0.0.1", resolve));
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const faceURL = new URL(`http://127.0.0.1:${face.address().port}`);
  const origin = `http://127.0.0.1:${reservation.address().port}`;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, [fileURLToPath(new URL("./dev.mjs", import.meta.url))], {
    env: { ...process.env, FACE_PROTOTYPE_ENABLED: "true", FACE_APP_ORIGIN: origin,
      FACE_SERVICE_URL: faceURL.origin, FACE_SERVICE_SECRET: secret, FACE_SIGNIN_ENABLED: "true", SUPABASE_SECRET_KEY: "synthetic-server-key" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    const deadline = Date.now() + 12000;
    while (!output.includes(`Open ${origin}/`)) {
      assert.equal(child.exitCode, null, "Development launcher exited before readiness");
      assert.ok(Date.now() < deadline, "Development launcher did not report readiness");
      await delay(100);
    }
    assert.match(output, /Using the running local face service/);
    const response = await fetch(`${origin}/api/face-login`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "config", userId: "00000000-0000-0000-0000-000000000000" }),
    });
    assert.deepEqual(await response.json(), { available: true });
    child.kill("SIGTERM");
    await exited;
    assert.equal(await faceServiceReady(faceURL, secret), true);
    assert.ok(checks >= 2);
    await assert.rejects(fetch(origin));
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await exited;
    await new Promise((resolve) => face.close(resolve));
  }
});
