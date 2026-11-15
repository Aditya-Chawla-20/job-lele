# Job Lele

A public job board for freshers and early career developers in India: AI, full stack, software, and data roles. Built for Aditya Chawla (@Aditya_Chawla20), who posts fresher job bundles on X.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How the data file works

All jobs live in `data/jobs.json`. Each job has:

- `id` - stable id, e.g. `naukri-111126504506`
- `title`, `company`, `location`
- `experience` - e.g. `0-2 yrs`, `1-2 yrs`, `Entry level`
- `salary` - string, or `null`. Only set it when the listing itself shows a salary. When null, the card shows no salary line at all.
- `postedDate` - ISO date the job was posted, e.g. `2026-11-12`
- `category` - one of `AI/ML`, `Full Stack`, `Software`, `Data`, `Other`
- `applyUrl` - the direct official apply link (Naukri or LinkedIn)
- `source` - `Naukri` or `LinkedIn`
- `sourceJobId` - the job id on the source site
- `verifiedDate` - ISO date the listing was last verified live

To update the board, edit `data/jobs.json` and redeploy. Jobs older than 7 days by `postedDate` are hidden automatically, so old entries drop off on their own. The page also revalidates once an hour, so the 7-day cutoff and posted labels stay fresh between deploys.

Rules for the data:

- Only list jobs verified live on the official page or the live LinkedIn/Naukri listing.
- Never invent a salary, date, or company. If the listing shows no salary, use `null`.
- Never list anything about Aditya's own applications or interviews.

## Filters

- Category, location, and experience come from the job fields. Location and experience are matched onto filter buckets in `lib/jobs.ts` (for example `Mumbai/Navi Mumbai` maps to `Mumbai`, and a range starting at 0 years maps to `Fresher / 0-1`).
- Recency uses calendar days because `postedDate` is a date, not a timestamp: `Last few hours` means posted today, `Last 24 hours` means posted today or yesterday, `Past 3 days` and `Past 7 days` are as named.
- Search matches title or company. Jobs sort newest first.

## Analytics

- `<Analytics />` from `@vercel/analytics` is in the root layout, so total visitors and page views show up in the Vercel dashboard.
- Every Apply click sends a custom event: `track("job_apply_click", { job: title, company })`. Per-job clicks show up under that event in the Vercel dashboard.

## Deploy

Option 1, Vercel CLI:

```bash
vercel --prod
```

Option 2, GitHub import: push this repo to GitHub, then import it at vercel.com/new. Vercel detects Next.js automatically. No build settings need changing.

Note: `@vercel/analytics` only collects data on the deployed site, not on localhost.
