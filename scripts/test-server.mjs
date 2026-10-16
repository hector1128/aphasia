import assert from "node:assert/strict";
import { createServer } from "node:http";
import handler from "../tmp/server-runtime/api/report.js";
const server = createServer((req, res) => void handler(req, res));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/report`);
  assert.equal(response.status, 405);
  assert.match((await response.json()).error, /Settings/);
  console.info("Compiled server runtime smoke check passed.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
