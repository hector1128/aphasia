import type { IncomingMessage, ServerResponse } from "node:http";
import { remindersMiddleware } from "../server/reminders-api.js";
const handler = remindersMiddleware(process.env);
export default (req: IncomingMessage, res: ServerResponse) => handler(req, res, () => { res.writeHead(404); res.end(); });
