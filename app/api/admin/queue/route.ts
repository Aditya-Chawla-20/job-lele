import { isSameOrigin, privateHeaders, signedInOwner } from "../../../../lib/analytics-server";
import { jobsPublishingEnabled } from "../../../../lib/published-jobs";
import { changeQueue } from "../../../../lib/sourcing-queue";

export async function POST(request: Request) {
  if (!jobsPublishingEnabled()) return new Response(null, { status: 404, headers: privateHeaders });
  if (!isSameOrigin(request) || !await signedInOwner()) return new Response(null, { status: 403, headers: privateHeaders });
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))
    return new Response(null, { status: 415, headers: privateHeaders });
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length < 1 || length > 16384)
    return new Response(null, { status: 413, headers: privateHeaders });
  let result = "failed";
  try { result = await changeQueue(await request.formData()); } catch { /* No upstream errors or form data in the response. */ }
  return new Response(null, { status: 303, headers: {
    ...privateHeaders, Location: "/admin/queue?result=" + encodeURIComponent(result),
  } });
}
