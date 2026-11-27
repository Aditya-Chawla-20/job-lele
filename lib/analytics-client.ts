import { attribution, type EventType } from "./analytics";

const KEY = "joblele.analytics.session.v1";
const IDLE = 30 * 60 * 1000;
let memorySession: Session | undefined;
let boardSent = false;
type Session = ReturnType<typeof attribution> & { id: string; seen: number };

function session(): Session {
  const now = Date.now();
  let saved = memorySession;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw) as Session;
  } catch { /* Storage is optional. */ }
  if (!saved || now < saved.seen || now - saved.seen >= IDLE) {
    saved = { ...attribution(location.search, document.referrer, location.hostname), id: crypto.randomUUID(), seen: now };
  }
  saved.seen = now;
  memorySession = saved;
  try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* Keep it only in memory. */ }
  return saved;
}

export function recordAnalytics(type: EventType, job: string | null = null) {
  try {
    if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    if (type === "board_view" && boardSent) return;
    const visit = session();
    const payload = JSON.stringify({ id: crypto.randomUUID(), session: visit.id, type, job, source: visit.source, campaign: visit.campaign });
    if (type === "board_view") boardSent = true;
    // Queue synchronously; never prevent default or wait before the Apply link opens.
    if (!navigator.sendBeacon?.("/api/analytics/events", new Blob([payload], { type: "application/json" }))) {
      void fetch("/api/analytics/events", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch { /* Analytics must never interrupt browsing or applying. */ }
}
