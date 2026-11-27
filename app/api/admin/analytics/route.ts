import { privateHeaders, readReport, signedInOwner } from "../../../../lib/analytics-server";

export async function GET() {
  if (!await signedInOwner()) return Response.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
  try { return Response.json(await readReport(), { headers: privateHeaders }); }
  catch { return Response.json({ error: "Analytics unavailable" }, { status: 503, headers: privateHeaders }); }
}
