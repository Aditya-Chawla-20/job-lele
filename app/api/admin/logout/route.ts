import { isSameOrigin, ownerLogout, privateHeaders } from "../../../../lib/analytics-server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403, headers: privateHeaders });
  await ownerLogout();
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: "/admin" } });
}
