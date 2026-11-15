import jobsData from "../data/jobs.json";
import JobBoard from "./JobBoard";
import GuptAIInstall from "./GuptAIInstall";
import { enrichJobsForDisplay } from "../lib/enrichments";
import { toJobView, type Job } from "../lib/jobs";

// Refresh descriptions and keywords published by GitHub Actions.
export const revalidate = 300;

export default async function Home() {
  const now = new Date();
  const recentJobs = (jobsData as Job[])
    .map((job) => toJobView(job, now))
    .filter((job) => job.daysAgo <= 7)
    .sort((a, b) => (a.postedDate < b.postedDate ? 1 : a.postedDate > b.postedDate ? -1 : 0));

  const jobs = await enrichJobsForDisplay(recentJobs);

  return (
    <div className="board-layout">
      <JobBoard jobs={jobs} />
      <GuptAIInstall />
    </div>
  );
}
