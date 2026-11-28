export const EVENT_TYPES = ["board_view", "detail_view", "apply_click"] as const;
export type EventType = typeof EVENT_TYPES[number];
export const SOURCES = ["direct", "x", "linkedin", "naukri", "search", "email", "other"] as const;
export type Source = typeof SOURCES[number];
export const DEVICES = ["mobile", "tablet", "desktop", "unknown"] as const;
export type Device = typeof DEVICES[number];

export type EventInput = {
  id: string; session: string; type: EventType; job: string | null; source: Source; campaign: string;
};
export const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export const CAMPAIGN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

function tag(s: string | null) {
  const v = s?.trim().toLowerCase();
  return v && CAMPAIGN.test(v) ? v : "";
}

export function attribution(search: string, referrer: string, siteHost: string): { source: Source; campaign: string } {
  const p = new URLSearchParams(search);
  const tagged = tag(p.get("utm_source"));
  const campaign = tag(p.get("utm_campaign"));
  function classify(value: string): Source {
    if (["x", "twitter", "t.co", "x.com", "twitter.com"].includes(value)) return "x";
    if (["linkedin", "linkedin.com", "lnkd.in"].includes(value)) return "linkedin";
    if (["naukri", "naukri.com"].includes(value)) return "naukri";
    if (["google", "bing", "duckduckgo", "search"].includes(value)) return "search";
    if (["email", "newsletter", "gmail"].includes(value)) return "email";
    return "other";
  }
  if (tagged) return { source: classify(tagged), campaign };
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host !== siteHost.toLowerCase()) {
      const root = ["x.com", "twitter.com", "t.co", "linkedin.com", "lnkd.in", "naukri.com"]
        .find((d) => host === d || host.endsWith("." + d));
      if (root) return { source: classify(root), campaign };
      if (/(^|\.)google\.(com|co\.in|co\.uk|in)$|(^|\.)(bing\.com|duckduckgo\.com)$/.test(host)) return { source: "search", campaign };
      return { source: "other", campaign };
    }
  } catch { /* No external referrer. */ }
  return { source: "direct", campaign };
}

export function classifyDevice(ua: string | null, mobileHint: string | null): Device {
  if (!ua) return mobileHint === "?1" ? "mobile" : "unknown";
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return "tablet";
  if (mobileHint === "?1" || /iphone|ipod|mobile/i.test(ua)) return "mobile";
  return "desktop";
}

export function parseEvent(value: unknown, knownJobIds: Pick<ReadonlySet<string>, "has">): EventInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { id, session, type, job, source, campaign } = value as Record<string, unknown>;
  if (typeof id !== "string" || !UUID.test(id) || typeof session !== "string" || !UUID.test(session)) return null;
  if (typeof type !== "string" || !EVENT_TYPES.includes(type as EventType)) return null;
  if (type === "board_view" ? job !== null : typeof job !== "string" || !knownJobIds.has(job)) return null;
  if (typeof source !== "string" || !SOURCES.includes(source as Source)) return null;
  if (typeof campaign !== "string" || (campaign !== "" && !CAMPAIGN.test(campaign))) return null;
  return { id, session, type: type as EventType, job: job as string | null, source: source as Source, campaign };
}

export type Counts = { board_views: number; detail_views: number; apply_clicks: number };
export type Breakdown = Counts & { label: string };
export type JobBreakdown = Omit<Counts, "board_views"> & { label: string; day: string; source: Source; device: Device };
export type AnalyticsReport = {
  totals: Counts & { sessions: number; converted_sessions: number };
  daily: Breakdown[]; sources: Breakdown[]; devices: Breakdown[];
  campaigns: Breakdown[]; jobs: Breakdown[]; job_daily: JobBreakdown[];
};
