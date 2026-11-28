import "server-only";
import { serviceRequest } from "./analytics-server";

export const queueStates = ["collected", "verified", "reserved", "sent_to_muse", "posted"] as const;
export type QueueState = (typeof queueStates)[number];
export const queueLabel: Record<QueueState, string> = {
  collected: "Collected", verified: "Verified", reserved: "Reserved",
  sent_to_muse: "Sent to Muse", posted: "Posted on X",
};
export type QueueJob = {
  id: string; sequence_no: number; company: string; title: string; location: string; experience: string;
  requisition: string | null; apply_url: string; posted_date: string | null;
  state: QueueState; batch_id: string | null; reserved_until: string | null; handoff_receipt: string | null;
  x_post_url: string | null; publication_basis: "owner_reported" | "link_confirmed" | null;
};
export const queueActions = ["add", "verify", "reserve", "release", "sent", "owner_posted"] as const;

export async function readQueue(state?: QueueState, before?: string) {
  const params = new URLSearchParams({
    select: "id,sequence_no,company,title,location,experience,requisition,apply_url,posted_date,state,batch_id,reserved_until,handoff_receipt,x_post_url,publication_basis",
    order: "sequence_no.desc", limit: "31",
  });
  if (state) params.set("state", "eq." + state);
  if (before) params.set("sequence_no", "lt." + before);
  const result = await serviceRequest("/rest/v1/joblele_sourcing_queue?" + params);
  if (!result.ok) throw new Error("Queue load failed");
  return (await result.json()) as QueueJob[];
}

async function rpc(name: string, args: Record<string, unknown>) {
  const r = await serviceRequest("/rest/v1/rpc/joblele_queue_" + name, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error("Queue write did not confirm");
  const value = await r.json() as { result?: string; possible_duplicate?: boolean };
  return value.possible_duplicate ? "review" : value.result ?? "failed";
}

export function publicUrl(value: string) {
  try {
    const url = new URL(value);
    if (value.length > 2048 || url.protocol !== "https:" || url.username || url.password || url.port ||
        !url.hostname.includes(".") || url.hash ||
        [...url.searchParams.keys()].some((k) => /^(token|access_token|auth|session|sid|signature|sig|key|email|applicant_id|candidate_id|code)$/i.test(k))) return null;
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|trk|trackingid|refid|ref|source|gh_src|fbclid|gclid|igshid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch { return null; }
}

export async function changeQueue(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? "").trim();
  const action = queueActions.find((v) => v === get("action"));
  const id = get("id");
  const batch = get("batch");
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (action === "add") {
    const url = publicUrl(get("url"));
    const date = get("date");
    const req = get("requisition");
    const fields = [["company", 100], ["title", 150], ["location", 100], ["experience", 100]] as const;
    if (!url || fields.some(([field, max]) => !get(field) || get(field).length > max)
      || (req && !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(req))
      || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return "invalid";
    return rpc("intake", {
      p_company: get("company"), p_title: get("title"), p_location: get("location"), p_experience: get("experience"),
      p_apply_url: url, p_requisition: req || null, p_posted_date: date || null,
    });
  }
  if (!action || !uuid.test(id)) return "invalid";
  if (action === "reserve") return rpc("reserve", { p_ids: [id] });
  if ((action === "sent" || action === "release") && !uuid.test(batch)) return "invalid";
  const evidence = get("evidence");
  if (evidence.length > 300) return "invalid";
  return rpc("move", { p_id: id, p_action: action, p_evidence: evidence || null, p_batch: batch || null });
}
