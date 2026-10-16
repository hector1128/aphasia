import type { IncomingMessage, ServerResponse } from "node:http";
import { reportMiddleware } from "../server/report-api.js";
// Vercel Node function; SMTP and Supabase credentials stay in server environment variables.
const handler = reportMiddleware(Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
));
export default (req: IncomingMessage, res: ServerResponse) => handler(req, res, () => {
  res.writeHead(404); res.end();
});
