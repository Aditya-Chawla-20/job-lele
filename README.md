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
- `descriptionSourceUrl` (optional) - the verified, public employer or company ATS posting. Add this when the application link points to an aggregator and the original employer URL is known.
- `description` (optional) - plain text from the verified posting. Use `\n` for paragraph breaks in JSON.
- `keywords` (optional) - an array of exact role-related terms from the original posting, e.g. `["Python", "FastAPI"]`.

Muse can add these fields to its existing payload. **View Details** shows the description and a link to the source. **Keywords** uses supplied terms first, then recognized terms in the description, then the role title and category. Omit unavailable fields or set them to `null`; never invent a description or a skill.

To update the board, edit `data/jobs.json` and redeploy. Jobs older than 7 days by `postedDate` are hidden automatically, so old entries drop off on their own. The page revalidates every five minutes on demand so enrichment and posting labels can refresh between deploys.

Rules for the data:

- Only list jobs verified live on the official page or the live LinkedIn/Naukri listing.
- Never invent a salary, date, or company. If the listing shows no salary, use `null`.
- Never list anything about Aditya's own applications or interviews.

## Automatic job enrichment

1. Add repository secrets named `GEMINI_API_KEY` and `NVIDIA_API_KEY` under [Settings → Secrets and variables → Actions](https://github.com/Aditya-Chawla-20/job-lele/settings/secrets/actions). Gemini 3.8 Flash (`gemini-3.8-flash`) is the primary model. Its Google Search grounding requires a paid Gemini API tier to discover employer ATS postings. NVIDIA Nemotron 3.5 Lightning (`nvidia/nemotron-3.5-lightning-30b-a3b`) is the fallback once source text is available.
2. Open **Actions → Enrich Job Lele listings → Run workflow** on `main`. Leave **Preview enrichment without publishing it** checked to inspect a run. Uncheck it to backfill and publish current jobs. New pushes that update `data/jobs.json` publish automatically.
3. Have Muse pull the workflow installation commit and refresh its expected `main` head before it resumes pushing.

The workflow reuses descriptions Muse provides. Otherwise, it reads the supplied employer URL or the exact `applyUrl` directly over HTTPS before using AI. It reads `JobPosting` metadata when available and can also extract the description from public LinkedIn job HTML after checking the listing ID, title and company. If direct requests do not yield a matching description, Gemini Search can look for the same job on a supported employer site. The model extracts keywords from the verified source text and writes a short description with a link to the source. Blocked pages and mismatched listings retain the board’s existing fallback.

The workflow publishes a separate `job-enrichment` branch. Job Lele reads it through its five-minute cache and matches entries to the listing they were derived from. Muse remains the writer of `data/jobs.json`; workflow runs do not advance `main`. A failed fetch, an invalid response or an unavailable sidecar leaves the original listing usable.

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

## Private analytics preview

`/admin` reports board views, job-detail opens (the existing Details dialog),
outbound Apply clicks, and anonymous session-to-click conversion for the last 30
calendar days (IST). It breaks activity down by landing source, device, campaign
and job. Apply links still open immediately; failed collection never blocks them.
An Apply click does not confirm an application. Standard ad blockers, opted-out
clients, and missing browser signals can make counts incomplete.

To wire the preview:

1. In a **separate Supabase Free preview project**, apply
   `supabase/migrations/202611270001_joblele_analytics.sql` via the SQL Editor or CLI.
   Enable the Data API for `public`; the migration limits these objects to
   `service_role`, with RLS on the events table.
2. In Auth, disable public signups and create one confirmed owner user. Use the
   owner's email as login ID and a strong unique password set privately.
3. Set the four variables in `.env.example` as **Preview only** (ideally restricted
   to this branch). `JOBLELE_SUPABASE_SERVICE_KEY` is the secret key or legacy
   `service_role` key; never paste it into chat or commit it. Use the owner's Auth
   UUID for `JOBLELE_OWNER_USER_ID`. Preview deployments made before adding
   variables need a new preview build. This implementation also disables itself in Vercel Production, even if variables are present.
4. Open the preview `/admin`, sign in with that owner, and open the board in a
   separate tab. Test Details and Apply. A non-owner must see only the sign-in
   screen; `GET /api/admin/analytics` without a valid owner session returns 401.
   Before setup the page explicitly reports unconfigured, and intake is a no-op.

For campaigns, use an agreed short public tag (e.g.
`/?utm_source=x&utm_campaign=ai_roles_nov`), never personal identifiers. Only
a normalized campaign tag, broad source/device, generated event/session IDs and
optional public job ID reach storage; no full referrer, raw user agent, IP, or
contact information is stored in the analytics table. A session ID lives in the
tab and rotates after 30 minutes of inactivity. Do Not Track and Global Privacy
Control opt-outs are honored. A first-party public intake can still be polluted
by scripted traffic; this is directional analytics, not an audited billing metric.

The owner session is checked against Supabase on each protected request, and
expires after at most an hour. The SQL report reads only the last 30 days,
but does not silently delete data. If this becomes permanent, prune older
rows according to an agreed retention policy and add platform rate limiting
before enabling high-volume collection. No production setup, paid service,
or background process is required by this preview.

### Publish jobs from the preview admin

Apply `supabase/migrations/202611270002_joblele_published_jobs.sql` in the
same isolated JobLele Preview project. No additional environment variables are
needed. In the hosted Preview, sign in at `/admin`, enter a listing using its
original date and verified HTTPS application link, and select **Publish to
preview**. Reload the board to see it without another deployment. The board
combines the Preview database rows with the bundled GitHub feed, keeping the
same seven-day recency behavior, filters and Apply flow. Direct database reads
and writes are not granted to public users or signed-in Supabase users.
The application uses the server key only and rechecks the owner for every
write. The production board and existing Muse/GitHub sync are unchanged.
