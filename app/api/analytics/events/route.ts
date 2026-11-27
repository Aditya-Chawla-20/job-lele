import jobs from "../../../../data/jobs.json";
import { classifyDevice, parseEvent } from "../../../../lib/analytics";
import { isAnalyticsConfigured, isSameOrigin, writeEvent } from "../../../../lib/analytics-server";

const ids = new Set(jobs.map((job) => job.id));
const LIMIT = 1024;

async function smallJSON(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > LIMIT || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    count += part.value.byteLength;
    if (count > LIMIT) { await reader.cancel(); return null; }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415 });
  if (!isAnalyticsConfigured() || request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return new Response(null, { status: 204 });
  try {
    const event = parseEvent(await smallJSON(request), ids);
    if (!event) return new Response(null, { status: 400 });
    await writeEvent({
      id: event.id, session_id: event.session, kind: event.type, job_id: event.job,
      source: event.source, campaign: event.campaign,
      device: classifyDevice(request.headers.get("user-agent"), request.headers.get("sec-ch-ua-mobile")),
    });
    return new Response(null, { status: 204 });
  } catch (e) { return new Response(null, { status: e instanceof SyntaxError ? 400 : 503 }); }
}
