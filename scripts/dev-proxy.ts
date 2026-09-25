// Local-dev twin of the Vercel function api/nansen.ts. `npm run dev` serves the
// app on :5173 and Vite forwards /api/* to this server (see vite.config server.proxy),
// so the live explorer runs end-to-end against real Nansen with `npm run dev:proxy`
// in a second terminal. The Nansen key is read from .env.local and stays server-side
// exactly as in production — this process is never deployed; in prod the same core
// (shared/liveQuery.ts) runs inside the serverless function instead.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { config } from "dotenv";
import { handleLiveQuery, handleRestore } from "../shared/liveQuery.ts";

config({ path: ".env.local" });

const PORT = Number(process.env.DEV_PROXY_PORT ?? 8787);

function clientIp(req: IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  return (raw?.split(",")[0]?.trim() || req.socket.remoteAddress) ?? "dev";
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (!req.url?.startsWith("/api/nansen") || req.method !== "POST") {
    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: "invalid_input", message: "Use POST /api/nansen." }));
    return;
  }
  const input = await readJson(req);
  const ip = clientIp(req);
  const action = (input as { action?: unknown } | null)?.action;
  const { status, body } = action === "restore" ? await handleRestore(ip) : await handleLiveQuery(input, ip);
  res.statusCode = status;
  res.end(JSON.stringify(body));
}).listen(PORT, () => {
  const key = process.env.NANSEN_API_KEY ? "key loaded" : "NO KEY (set NANSEN_API_KEY in .env.local)";
  console.log(`nansen dev proxy → http://localhost:${PORT}  (${key})`);
});
