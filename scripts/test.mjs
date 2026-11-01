import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const tests = readdirSync("src", { recursive: true })
  .filter((file) => /\.test\.tsx?$/.test(file))
  .sort()
  .map((file) => join("src", file));
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...process.argv.slice(2), ...tests], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
