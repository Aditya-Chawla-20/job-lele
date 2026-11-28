import { isSameOrigin, privateHeaders, signedInOwner } from "../../../../lib/analytics-server";
import { jobsPublishingEnabled, publishJob } from "../../../../lib/published-jobs";

export async function POST(request: Request) {
  if (!jobsPublishingEnabled()) return new Response(null, { status: 404, headers: privateHeaders });
  if (!isSameOrigin(request) || !await signedInOwner()) {
    return new Response(null, { status: 403, headers: privateHeaders });
  }
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return new Response(null, { status: 415, headers: privateHeaders });
  }
  // HTML forms send Content-Length; reject missing/oversize bodies before reading.
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length < 1 || length > 65536) {
    return new Response(null, { status: 413, headers: privateHeaders });
  }
  let result = "invalid";
  try { result = await publishJob(await request.formData()); } catch { /* Invalid form body. */ }
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: "/admin?job=" + result + "#publish-job" } });
}
