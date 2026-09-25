// Vercel serverless function: the same-origin proxy behind the live Nansen
// explorer. It holds the Nansen key server-side (process.env.NANSEN_API_KEY) and
// forwards ONE validated, rate-limited call per request. The key never reaches the
// browser — the client only ever talks to this endpoint. All logic lives in the
// runtime-agnostic core (shared/liveQuery.ts), shared with the Vite dev middleware.
import type { IncomingMessage, ServerResponse } from "node:http";

type Req = IncomingMessage & { body?: unknown };

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function clientIp(req: Req): string {
  const xff = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  return (raw?.split(",")[0]?.trim() || req.socket?.remoteAddress) ?? "unknown";
}

async function readJson(req: Req): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? safeParse(req.body) : req.body;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  return safeParse(Buffer.concat(chunks).toString("utf8"));
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "invalid_input", message: "Use POST." }));
    return;
  }
  try {
    // Loaded lazily inside the try so a module-load error becomes parseable JSON
    // for the client rather than an unhandled 500 page.
    const { handleLiveQuery } = await import("../shared/liveQuery.js");
    const input = await readJson(req);
    const { status, body } = await handleLiveQuery(input, clientIp(req));
    res.statusCode = status;
    res.end(JSON.stringify(body));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: "network", message: "The live explorer hit a temporary error. Try again in a moment." }));
  }
}
