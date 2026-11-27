import "server-only";
import { cookies } from "next/headers";
import { UUID, type AnalyticsReport } from "./analytics";

const COOKIE = "joblele_admin";
const NO_STORE = "private, no-store";
export const privateHeaders = { "Cache-Control": NO_STORE, "X-Robots-Tag": "noindex, nofollow" };

function baseURL() {
  try {
    const url = new URL(process.env.JOBLELE_SUPABASE_URL ?? "");
    if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) return url.origin;
  } catch { /* Not configured. */ }
  return null;
}

function config() {
  if (process.env.VERCEL_ENV === "production") return null;
  const base = baseURL();
  const publicKey = process.env.JOBLELE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.JOBLELE_SUPABASE_SERVICE_KEY;
  const ownerId = process.env.JOBLELE_OWNER_USER_ID;
  return base && publicKey && serviceKey && ownerId && UUID.test(ownerId) ? { base, publicKey, serviceKey, ownerId } : null;
}

export function isAnalyticsConfigured() { return config() !== null; }

async function call(path: string, key: string, init: RequestInit = {}, token?: string) {
  const c = config();
  if (!c) throw new Error("Analytics is not configured");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  if (token) headers.set("Authorization", "Bearer " + token);
  // The legacy service_role JWT also needs the Authorization header.
  if (!token && key.startsWith("ey")) headers.set("Authorization", "Bearer " + key);
  return fetch(c.base + path, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(6000) });
}

export function serviceRequest(path: string, init?: RequestInit) {
  const c = config();
  if (!c) throw new Error("JobLele database is not configured");
  return call(path, c.serviceKey, init);
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  const host = request.headers.get("host");
  if (!host || !/^[a-z0-9.-]+(?::[0-9]+)?$/i.test(host)) return false;
  // Next can canonicalize a loopback request URL to localhost internally.
  const scheme = process.env.VERCEL === "1" ? "https:" : new URL(request.url).protocol;
  return origin === scheme + "//" + host.toLowerCase();
}

export async function signedInOwner() {
  const c = config();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!c || !token || token.length > 3500) return false;
  try {
    const res = await call("/auth/v1/user", c.publicKey, {}, token);
    if (!res.ok) return false;
    const user = await res.json();
    return user.id === c.ownerId;
  } catch { return false; }
}

export async function ownerLogin(email: string, password: string) {
  const c = config();
  if (!c || email.length > 254 || password.length > 256 || !email || !password) return false;
  try {
    const res = await call("/auth/v1/token?grant_type=password", c.publicKey, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.user?.id !== c.ownerId || typeof data.access_token !== "string" || data.access_token.length > 3500) return false;
    (await cookies()).set(COOKIE, data.access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/", maxAge: Math.min(Number(data.expires_in) || 3600, 3600),
    });
    return true;
  } catch { return false; }
}

export async function ownerLogout() {
  (await cookies()).set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}

export async function writeEvent(row: Record<string, unknown>) {
  const c = config();
  if (!c) return;
  const r = await call("/rest/v1/joblele_analytics_events?on_conflict=id", c.serviceKey, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error("Event store unavailable");
}

export async function readReport(days = 30): Promise<AnalyticsReport> {
  const c = config();
  if (!c) throw new Error("Analytics is not configured");
  const r = await call("/rest/v1/rpc/joblele_analytics_report", c.serviceKey, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ window_days: days }),
  });
  if (!r.ok) throw new Error("Analytics report unavailable");
  return r.json();
}
