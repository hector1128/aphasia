import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createServer, loadEnv } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const loopback = (host) => ["127.0.0.1", "localhost", "[::1]"].includes(host);

export function devOrigin(config) {
  const origin = new URL(config.FACE_PROTOTYPE_ENABLED === "true"
    ? config.FACE_APP_ORIGIN || "http://127.0.0.1:5173" : "http://127.0.0.1:5173");
  if (origin.protocol !== "http:" || !loopback(origin.hostname) || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash)
    throw Error("For local face authentication, set FACE_APP_ORIGIN to a local address such as http://127.0.0.1:5173 in .env.local.");
  if (config.FACE_PROTOTYPE_ENABLED === "true" && !config.FACE_APP_ORIGIN)
    throw Error("Set FACE_APP_ORIGIN=http://127.0.0.1:5173 in .env.local before enabling face authentication.");
  return origin;
}

export async function faceServiceReady(url, secret, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(new URL("/v1/face", url), {
      method: "POST", signal: AbortSignal.timeout(2000), redirect: "error",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", userId: "00000000-0000-0000-0000-000000000000" }),
    });
  } catch (error) {
    if (["ECONNREFUSED", "ECONNRESET"].includes(error.cause?.code) || ["TimeoutError", "AbortError"].includes(error.name)) return false;
    throw error;
  }
  if (!response.ok) throw Error(`The face service at ${url.origin} rejected the startup check (HTTP ${response.status}). Check FACE_SERVICE_SECRET on both services.`);
  let status;
  try { status = await response.json(); } catch { /* Report an incompatible listener below. */ }
  if (typeof status?.enrolled !== "boolean" || typeof status?.registered !== "boolean")
    throw Error(`The server at ${url.origin} is not responding as the private face service.`);
  return true;
}

async function main() {
  const config = { ...loadEnv("development", root, ""), ...process.env };
  const origin = devOrigin(config);
  let face;
  let closing = false;
  let faceStopped;
  const stopFace = () => {
    if (!face?.pid || face.exitCode !== null || face.signalCode !== null) return Promise.resolve();
    faceStopped ??= new Promise((resolve) => {
      face.once("exit", resolve);
      face.kill("SIGTERM");
    });
    return faceStopped;
  };
  const server = await createServer({ root, server: {
    host: origin.hostname.replace(/^\[|\]$/g, ""), port: Number(origin.port || 80), strictPort: true,
  }, plugins: [{ name: "local-face-service-lifecycle", closeBundle: () => closing ? stopFace() : undefined }] });
  const stop = async () => {
    if (closing) return;
    closing = true;
    await Promise.all([stopFace(), server.close()]);
  };
  // Vite also handles SIGTERM/stdin closure and exits after its close hooks.
  // Mark shutdown first, then make its close hook await our Python child too.
  process.prependOnceListener("SIGINT", () => void stop());
  process.prependOnceListener("SIGTERM", () => void stop());
  process.stdin.prependOnceListener("end", () => void stop());
  try {
    // A fixed address prevents Vite from moving to another browser-storage origin.
    await server.listen();
    if (config.FACE_PROTOTYPE_ENABLED === "true") {
      if (!config.FACE_SERVICE_URL || !config.FACE_SERVICE_SECRET)
        throw Error("Set FACE_SERVICE_URL and FACE_SERVICE_SECRET in .env.local.");
      const url = new URL(config.FACE_SERVICE_URL);
      if (url.username || url.password || url.search || url.hash ||
          !(url.protocol === "https:" || (url.protocol === "http:" && loopback(url.hostname))))
        throw Error("FACE_SERVICE_URL must use HTTPS, or HTTP on a loopback address for local development.");
      if (url.protocol === "http:" && loopback(url.hostname)) {
        if (await faceServiceReady(url, config.FACE_SERVICE_SECRET)) {
          console.info("Using the running local face service.");
        } else {
          const folder = path.join(root, "face-service");
          const python = path.join(folder, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
          if (!existsSync(python))
            throw Error("Create the Python environment with python3 -m venv face-service/.venv, then install face-service/requirements-export.txt into it.");
          const faceConfig = loadEnv("development", folder, "FACE_");
          if (faceConfig.FACE_SERVICE_SECRET !== config.FACE_SERVICE_SECRET)
            throw Error("FACE_SERVICE_SECRET must match between .env.local and face-service/.env.");
          const childEnv = { ...process.env, ...faceConfig };
          delete childEnv.SUPABASE_SECRET_KEY;
          delete childEnv.SUPABASE_SERVICE_ROLE_KEY;
          console.info("Starting the local face service; verifying/preparing models…");
          face = spawn(python, ["face-service/start_service.py", "--host", url.hostname.replace(/^\[|\]$/g, ""),
            "--port", url.port || "80"], { cwd: root, env: childEnv, stdio: "inherit" });
          let spawnError;
          face.on("error", (error) => { spawnError = error; });
          face.once("exit", () => {
            if (!closing) {
              console.error("The face service stopped. Fix the Python error above and restart npm run dev.");
              process.exitCode = 1;
              void stop();
            }
          });
          const deadline = Date.now() + 120000;
          while (!await faceServiceReady(url, config.FACE_SERVICE_SECRET)) {
            if (closing || spawnError || face.exitCode !== null || face.signalCode !== null)
              throw Error("The face service failed to start. Check the Python error above.");
            if (Date.now() >= deadline) throw Error("The face service did not become ready within two minutes. Check its startup output.");
            await delay(200);
          }
          console.info("Local face service ready.");
        }
      } else {
        console.info("Using the configured remote face service.");
      }
    }
    if (!closing) {
      console.info(`Open ${origin.origin}/ in your registered browser.`);
      server.printUrls();
    }
  } catch (error) {
    await stop();
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`Development startup failed: ${error.message}`); process.exitCode = 1; });
}
