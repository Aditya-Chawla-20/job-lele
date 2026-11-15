import { createHash } from "node:crypto";
import type { Job } from "./jobs";

const FEED_URL =
  "https://raw.githubusercontent.com/Aditya-Chawla-20/job-lele/job-enrichment/enrichments.json";

type Enrichment = {
  fingerprint?: unknown;
  description?: unknown;
  keywords?: unknown;
  descriptionSourceUrl?: unknown;
};

async function readEnrichments(): Promise<Record<string, Enrichment>> {
  try {
    const response = await fetch(FEED_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return {};
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    // The board still serves the original feed if the sidecar is unavailable.
    return {};
  }
}

function fingerprint(job: Job): string {
  return createHash("sha256").update(JSON.stringify([
    job.title, job.company, job.location, job.postedDate, job.applyUrl,
    job.descriptionSourceUrl ?? null, job.description ?? null,
  ])).digest("hex");
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return value;
  } catch {
    return;
  }
}

export async function enrichJobsForDisplay<T extends Job>(jobs: T[]): Promise<T[]> {
  const records = await readEnrichments();
  return jobs.map((job) => {
    const entry = records[job.id];
    if (!entry || entry.fingerprint !== fingerprint(job)) return job;
    const generatedDescription =
      typeof entry.description === "string" ? entry.description.trim() : "";
    const keywords = Array.isArray(entry.keywords)
      ? entry.keywords.filter((word): word is string => typeof word === "string" && !!word.trim())
      : [];
    return {
      ...job,
      description: job.description?.trim() ? job.description : generatedDescription || undefined,
      descriptionSourceUrl: job.description?.trim()
        ? httpsUrl(job.descriptionSourceUrl)
        : httpsUrl(entry.descriptionSourceUrl),
      keywords: job.keywords?.length ? job.keywords : keywords,
    };
  });
}
