import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

// Disk cache for raw Nansen responses. Every call is made at most once, ever:
// the response is written to .cache/ keyed by a hash of (endpoint + body), so
// reruns of the dataset builder cost ZERO credits. This is the single most
// important guard on the credit budget.

const CACHE_DIR = path.resolve(process.cwd(), ".cache");

function keyFor(endpoint: string, body: unknown): string {
  const h = createHash("sha256")
    .update(endpoint + "|" + JSON.stringify(body))
    .digest("hex")
    .slice(0, 24);
  const safe = endpoint.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  return `${safe}__${h}.json`;
}

export async function readCache<T>(endpoint: string, body: unknown): Promise<T | null> {
  const file = path.join(CACHE_DIR, keyFor(endpoint, body));
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeCache(endpoint: string, body: unknown, data: unknown): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, keyFor(endpoint, body));
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}
