import type { IncomingMessage, ServerResponse } from "node:http";
import { faceMiddleware } from "../server/face-api.js";

const handler = faceMiddleware(process.env);
export default (req: IncomingMessage, res: ServerResponse) => handler(req, res, () => {
  res.writeHead(404); res.end();
});
