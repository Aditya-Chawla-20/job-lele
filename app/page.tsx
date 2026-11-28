import { connection } from "next/server";
import { Analytics } from "@vercel/analytics/react";
import jobsData from "../data/jobs.json";
import JobBoard from "./JobBoard";
import GuptAIInstall from "./GuptAIInstall";
import { enrichJobsForDisplay } from "../lib/enrichments";
import { toJobView, type Job } from "../lib/jobs";

import { jobsPublishingEnabled, readPublishedJobs } from "../lib/published-jobs";

// Refresh descriptions and keywords published by GitHub Actions.
export const revalidate = 300;

export default async function Home() {
  // Scheduled preview jobs must become visible on the first request after their release time.
  if (jobsPublishingEnabled()) await connection();
  const now = new Date();
  const published = await readPublishedJobs(now);
  const recentJobs = [...published, ...jobsData as Job[]]
    .map((job) => toJobView(job, now))
    .filter((job) => job.daysAgo <= 7)
    .sort((a, b) => (a.postedDate < b.postedDate ? 1 : a.postedDate > b.postedDate ? -1 : 0));

  const jobs = await enrichJobsForDisplay(recentJobs);

  return (
    <div className="board-layout">
      <JobBoard jobs={jobs} />
      <GuptAIInstall />
      <Analytics />
    </div>
  );
}
