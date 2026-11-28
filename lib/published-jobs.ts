import "server-only";
import { randomUUID } from "node:crypto";
import bundledJobs from "../data/jobs.json";
import { isAnalyticsConfigured, serviceRequest } from "./analytics-server";
import { CATEGORIES, type Job } from "./jobs";

export const PUBLISHED_JOB_ID = /^admin-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const boardDate = (date: Date) => date.toISOString().slice(0, 10);
function firstVisibleDate(now: Date) {
  return boardDate(new Date(now.getTime() - 7 * 86400_000));
}

export function jobsPublishingEnabled() {
  return process.env.VERCEL_ENV === "preview" && isAnalyticsConfigured();
}

type Listing = Omit<Job, "id" | "postedDate" | "applyUrl" | "sourceJobId">;
type Row = { id: string; posted_date: string; apply_url: string; listing: Listing };
function fromRow(row: Row): Job {
  return {
    ...row.listing, id: row.id, postedDate: row.posted_date,
    applyUrl: row.apply_url, sourceJobId: row.id,
  };
}

const storePath = "/rest/v1/joblele_published_jobs";

export async function readPublishedJobs(now: Date) {
  if (!jobsPublishingEnabled()) return [];
  try {
    const params = new URLSearchParams({
      select: "id,posted_date,apply_url,listing",
      and: `(posted_date.gte.${firstVisibleDate(now)},posted_date.lte.${boardDate(now)})`,
      published_at: "lte." + now.toISOString(),
      order: "posted_date.desc,published_at.desc",
    });
    const response = await serviceRequest(storePath + "?" + params);
    if (!response.ok) throw new Error();
    return ((await response.json()) as Row[]).map(fromRow);
  } catch {
    console.warn("JobLele preview listings unavailable; serving the bundled feed");
    return [];
  }
}

export async function isPublishedJob(id: string, now = new Date()) {
  if (!jobsPublishingEnabled() || !PUBLISHED_JOB_ID.test(id)) return false;
  const params = new URLSearchParams({
    select: "id", id: "eq." + id, published_at: "lte." + now.toISOString(), limit: "1",
  });
  const response = await serviceRequest(storePath + "?" + params);
  if (!response.ok) throw new Error("Preview jobs unavailable");
  return (await response.json()).length === 1;
}

function cleanApplyUrl(value: string) {
  try {
    if (value.length > 2048) return null;
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.hash || u.href.length > 2048) return null;
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_.+|trk|trackingId|refId)$/i.test(key)) u.searchParams.delete(key);
    }
    return u;
  } catch { return null; }
}

export async function readScheduledJobs(now: Date) {
  const params = new URLSearchParams({
    select: "id,listing,published_at", published_at: "gt." + now.toISOString(),
    order: "published_at.asc", limit: "50",
  });
  const response = await serviceRequest(storePath + "?" + params);
  if (!response.ok) throw new Error("Scheduled preview jobs unavailable");
  return await response.json() as { id: string; listing: Listing; published_at: string }[];
}

export async function publishJob(form: FormData, now = new Date()) {
  if (!jobsPublishingEnabled()) return "disabled";
  const get = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const title = get("title");
  const company = get("company");
  const location = get("location");
  const experience = get("experience").replace(/(?<=\d)\s*[–—−]\s*(?=\d)/g, "-");
  const salary = get("salary");
  const description = get("description");
  const category = CATEGORIES.find((value) => value === get("category"));
  const postedDate = get("postedDate");
  const url = cleanApplyUrl(get("applyUrl"));
  if (!title || title.length > 150 || !company || company.length > 100
    || !location || location.length > 100 || !experience || experience.length > 80
    || salary.length > 100 || description.length > 5000 || !category || !url
    || !/^\d{4}-\d{2}-\d{2}$/.test(postedDate) || postedDate < firstVisibleDate(now) || postedDate > boardDate(now)) {
    return "invalid";
  }
  const date = new Date(postedDate + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || boardDate(date) !== postedDate) return "invalid";
  const publishAt = get("publishAt");
  const release = publishAt ? new Date(publishAt + ":00+05:30") : now;
  if (publishAt && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(publishAt)
    || !Number.isFinite(release.getTime()) || release <= now
    || new Date(release.getTime() + 330 * 60_000).toISOString().slice(0, 16) !== publishAt
    || postedDate < firstVisibleDate(release))) return "invalid-time";
  if (bundledJobs.some((job) => cleanApplyUrl(job.applyUrl)?.href === url.href)) return "duplicate";
  const host = url.hostname;
  const source = /(^|\.)linkedin\.com$/.test(host) ? "LinkedIn"
    : /(^|\.)naukri\.com$/.test(host) ? "Naukri" : "job site";
  const id = "admin-" + randomUUID();
  const listing: Listing = {
    title, company, location, experience, category, source,
    salary: salary || null, description: description || null, verifiedDate: boardDate(now),
  };
  try {
    const response = await serviceRequest(storePath, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ id, posted_date: postedDate, apply_url: url.href, listing, published_at: release.toISOString() }),
    });
    if (response.status === 409) return "duplicate";
    if (!response.ok) throw new Error();
    return publishAt ? "scheduled" : "published";
  } catch {
    console.warn("JobLele preview job write did not confirm");
    return "failed";
  }
}
