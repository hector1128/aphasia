import assert from "node:assert/strict";
import { createServer } from "node:http";
import handler from "../tmp/server-runtime/api/report.js";
import reminderHandler from "../tmp/server-runtime/api/reminders.js";
import faceHandler from "../tmp/server-runtime/api/face.js";
import faceLoginHandler from "../tmp/server-runtime/api/face-login.js";
const server = createServer((req, res) => void (req.url === "/api/reminders" ? reminderHandler : req.url === "/api/face" ? faceHandler : req.url === "/api/face-login" ? faceLoginHandler : handler)(req, res));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/report`);
  assert.equal(response.status, 405);
  assert.match((await response.json()).error, /Settings/);
  const face = await fetch(`http://127.0.0.1:${server.address().port}/api/face`);
  assert.equal(face.status, 405);
  assert.equal(face.headers.get("cache-control"), "no-store");
  const login = await fetch(`http://127.0.0.1:${server.address().port}/api/face-login`);
  assert.equal(login.status, 405);
  const reminder = await fetch(`http://127.0.0.1:${server.address().port}/api/reminders`);
  assert.equal(reminder.status, 401);
  console.info("Compiled server runtime smoke check passed.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
