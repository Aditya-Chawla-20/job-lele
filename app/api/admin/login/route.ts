import { isAnalyticsConfigured, isSameOrigin, ownerLogin, privateHeaders } from "../../../../lib/analytics-server";

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: location } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403, headers: privateHeaders });
  if (!isAnalyticsConfigured()) return new Response(null, { status: 503, headers: privateHeaders });
  if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded" || Number(request.headers.get("content-length")) > 4096) {
    return new Response(null, { status: 400, headers: privateHeaders });
  }
  const fields = new URLSearchParams(await request.text());
  return redirect(await ownerLogin(fields.get("email") ?? "", fields.get("password") ?? "") ? "/admin" : "/admin?error=1");
}
