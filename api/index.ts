import type { VercelRequest, VercelResponse } from "@vercel/node";

const workerOrigin = process.env.WORKER_ORIGIN || "https://vad-26-show-control.saintmob.workers.dev";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const target = new URL(req.url || "/api/state", workerOrigin);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (["host", "content-length", "connection", "transfer-encoding"].includes(key.toLowerCase())) continue;
      if (value === undefined) continue;
      if (Array.isArray(value)) headers.set(key, value.join(","));
      else headers.set(key, value);
    }

    const method = req.method || "GET";
    const hasBody = method !== "GET" && method !== "HEAD";
    const response = await fetch(target, {
      method,
      headers,
      body: hasBody ? serializeRequestBody(req.body) : undefined
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function serializeRequestBody(body: unknown) {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string" || body instanceof Uint8Array) return body;
  return JSON.stringify(body);
}
