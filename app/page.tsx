import jobsData from "../data/jobs.json";
import JobBoard from "./JobBoard";
import GuptAIInstall from "./GuptAIInstall";
import { toJobView, type Job } from "../lib/jobs";

// Re-render at most once an hour so the 7-day cutoff and posted labels
// stay fresh between deploys.
export const revalidate = 3600;

export default function Home() {
  const now = new Date();
  const jobs = (jobsData as Job[])
    .map((job) => toJobView(job, now))
    .filter((job) => job.daysAgo <= 7)
    .sort((a, b) => (a.postedDate < b.postedDate ? 1 : a.postedDate > b.postedDate ? -1 : 0));

  return (
    <>
      <JobBoard jobs={jobs} />
      <GuptAIInstall />
    </>
  );
}
