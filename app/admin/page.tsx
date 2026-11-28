import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import jobs from "../../data/jobs.json";
import { boardDate, jobsPublishingEnabled, readPublishedJobs, readScheduledJobs } from "../../lib/published-jobs";
import { CATEGORIES } from "../../lib/jobs";
import type { AnalyticsReport, Breakdown } from "../../lib/analytics";
import { isAnalyticsConfigured, readReport, signedInOwner, writeEvent } from "../../lib/analytics-server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private analytics | Job Lele", robots: { index: false, follow: false }, referrer: "same-origin" };
const istTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const testJob = "preview-test-job";
const counts = new Intl.NumberFormat("en-IN");
const percent = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 1 });

function Table({ title, label, rows, names }: { title: string; label: string; rows: Breakdown[]; names?: Map<string, string> }) {
  return <section className={styles.panel}>
    <h3>{title}</h3>
    {!rows.length ? <p className={styles.note}>No events yet.</p> : <div className={styles.scroll} tabIndex={0} role="region" aria-label={title}>
      <table aria-label={title}><thead><tr><th scope="col">{label}</th>{!names && <th scope="col">Board views</th>}<th scope="col">Details</th><th scope="col">Apply clicks</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{names?.get(row.label) ?? row.label}</th>{!names && <td>{counts.format(row.board_views)}</td>}<td>{counts.format(row.detail_views)}</td><td>{counts.format(row.apply_clicks)}</td></tr>)}</tbody>
      </table>
    </div>}
  </section>;
}

function Report({ report: r, names }: { report: AnalyticsReport; names: Map<string, string> }) {
  const t = r.totals;
  const cards = [
    ["Board views", counts.format(t.board_views)],
    ["Job detail opens", counts.format(t.detail_views)],
    ["Apply clicks", counts.format(t.apply_clicks)],
    ["Anonymous sessions", counts.format(t.sessions)],
    ["Sessions with an Apply click", t.sessions ? percent.format(t.converted_sessions / t.sessions) : "—"],
  ];
  return <>
    <dl className={styles.metrics}>{cards.map(([name, value]) => <div className={styles.metric} key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    <p className={styles.note}>Apply clicks count outbound clicks, not completed applications. Session attribution uses the first tracked visit in a tab until 30 minutes idle.</p>
    <div className={styles.grid}>
      <Table title="Daily activity" label="Date (IST)" rows={r.daily} />
      <Table title="Traffic sources" label="Source" rows={r.sources} />
      <Table title="Devices" label="Device" rows={r.devices} />
      <Table title="Tagged campaigns" label="Campaign" rows={r.campaigns} />
    </div>
    <Table title="Top jobs" label="Job" rows={r.jobs} names={names} />
    <section className={styles.panel}>
      <h3>Jobs by day, source and device</h3>
      <p className={styles.note}>Up to 250 recent breakdown rows.</p>
      {!r.job_daily.length ? <p className={styles.note}>No job events yet.</p> : <div className={styles.scroll} tabIndex={0} role="region" aria-label="Jobs by day, source and device">
        <table aria-label="Jobs by day, source and device"><thead><tr><th scope="col">Date (IST)</th><th scope="col">Job</th><th scope="col">Source</th><th scope="col">Device</th><th scope="col">Details</th><th scope="col">Apply clicks</th></tr></thead>
          <tbody>{r.job_daily.map((row) => <tr key={[row.day, row.label, row.source, row.device].join("|")}><td>{row.day}</td><th scope="row">{names.get(row.label) ?? row.label}</th><td>{row.source}</td><td>{row.device}</td><td>{counts.format(row.detail_views)}</td><td>{counts.format(row.apply_clicks)}</td></tr>)}</tbody>
        </table>
      </div>}
    </section>
  </>;
}

function PublishForm({ status, today }: { status?: string; today: string }) {
  return <section id="publish-job" className={styles.panel} aria-labelledby="publish-title">
    <h3 id="publish-title">Publish a job</h3>
    <p className={styles.note}>Preview only. Publishing adds the listing to the preview board. The live site and Muse feed are unchanged.</p>
    {status === "published" && <p role="status">Job published. <a href="/">View the preview board</a>.</p>}
    {status === "scheduled" && <p role="status">Job scheduled for the preview board.</p>}
    {status === "invalid-time" && <p role="alert">Choose a future IST time while the listing is still within the board’s 7-day window.</p>}
    {status === "duplicate" && <p role="alert">A job with this application link is already on the board.</p>}
    {status === "invalid" && <p role="alert">The job wasn’t saved. Check the required fields, posting date, and HTTPS application link.</p>}
    {status === "failed" && <p role="alert">Saving couldn’t be confirmed. Check the preview board or scheduled jobs before retrying.</p>}
    <form className={styles.form} method="post" action="/api/admin/jobs">
      <div className={styles.grid}>
        <label>Job title<input name="title" maxLength={150} required /></label>
        <label>Company<input name="company" maxLength={100} required /></label>
        <label>Location<input name="location" placeholder="e.g. Pune, hybrid" maxLength={100} required /></label>
        <label>Experience<input name="experience" placeholder="e.g. 0–2 years" maxLength={80} required /></label>
        <label>Category<select name="category" defaultValue="" required>
          <option value="" disabled>Select category</option>
          {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label>Original posting date<input type="date" name="postedDate" max={today} aria-describedby="posted-date-help" required />
          <span id="posted-date-help" className={styles.note}>Use the actual posting date, within the board’s 7-day window.</span>
        </label>
      </div>
      <label>Application URL<input name="applyUrl" type="url" placeholder="https://" maxLength={2048} required /></label>
      <label>Publish at (IST, optional)<input name="publishAt" type="datetime-local" aria-describedby="publish-at-help" />
        <span id="publish-at-help" className={styles.note}>Enter India time. Leave blank to publish immediately.</span>
      </label>
      <label>Salary (optional)<input name="salary" maxLength={100} /></label>
      <label>Description (optional)<textarea name="description" maxLength={5000} rows={4} /></label>
      <button type="submit" className="button button-primary">Publish or schedule</button>
    </form>
  </section>;
}

async function recordPreviewTest() {
  "use server";
  if (process.env.VERCEL_ENV !== "preview" || !await signedInOwner()) redirect("/admin");
  const session_id = randomUUID();
  const base = { session_id, source: "direct", campaign: "preview-smoke", device: "unknown" };
  let status = "recorded";
  try {
    await writeEvent({ ...base, id: randomUUID(), kind: "board_view", job_id: null });
    await writeEvent({ ...base, id: randomUUID(), kind: "detail_view", job_id: testJob });
  } catch {
    // No user, job, request payload, upstream details or credentials in logs.
    console.warn("JobLele preview synthetic event write failed");
    status = "failed";
  }
  redirect("/admin?test=" + status);
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; test?: string; job?: string }> }) {
  const configured = isAnalyticsConfigured();
  const owner = configured && await signedInOwner();
  if (!owner) {
    const error = (await searchParams).error;
    return <section className={styles.login} aria-labelledby="analytics-title">
      <a href="/">← Job board</a>
      <h2 id="analytics-title">Private analytics</h2>
      {!configured ? <p>This preview has not been connected to an analytics database.</p> : <>
        <p className={styles.note}>Sign in with the owner account.</p>
        {error && <p role="alert">Couldn’t sign in. Check your credentials and try again.</p>}
        <form className={styles.form} method="post" action="/api/admin/login">
          <label>Email<input type="email" name="email" autoComplete="username" maxLength={254} required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" maxLength={256} required /></label>
          <button type="submit" className="button button-primary">Sign in</button>
        </form>
      </>}
    </section>;
  }
  const requestHeaders = await headers();
  const optedOut = requestHeaders.get("dnt") === "1" || requestHeaders.get("sec-gpc") === "1";
  const preview = process.env.VERCEL_ENV === "preview";
  const { test, job } = await searchParams;
  const now = new Date();
  const publishing = jobsPublishingEnabled();
  const [published, scheduled] = await Promise.all([
    readPublishedJobs(now),
    publishing ? readScheduledJobs(now).catch(() => null) : Promise.resolve([]),
  ]);
  const names = new Map([...jobs, ...published].map((item) => [item.id, item.title + " · " + item.company]));
  names.set(testJob, "Preview test job (synthetic)");
  let report: AnalyticsReport | null = null;
  try { report = await readReport(); } catch { console.warn("JobLele private analytics report unavailable"); }
  return <section className={styles.dashboard} aria-labelledby="analytics-title">
    <div className={styles.heading}>
      <div><p className={styles.note}>OWNER ONLY · LAST 30 DAYS (IST)</p><h2 id="analytics-title">Job Lele analytics</h2></div>
      <form method="post" action="/api/admin/logout"><button className="button" type="submit">Sign out</button></form>
    </div>
    {publishing && <p><a href="/admin/queue">Open sourcing queue →</a></p>}
    {publishing && <PublishForm status={job} today={boardDate(now)} />}
    {publishing && <section className={styles.panel} aria-labelledby="scheduled-title">
      <h3 id="scheduled-title">Scheduled jobs (IST)</h3>
      {!scheduled ? <p className={styles.note}>Scheduled jobs are temporarily unavailable.</p>
        : scheduled.length === 0 ? <p className={styles.note}>No upcoming jobs.</p>
        : <ul>{scheduled.map(({ id, listing, published_at }) => <li key={id}>
          {listing.title} · {listing.company} · <time dateTime={published_at}>{istTime.format(new Date(published_at))} IST</time>
        </li>)}</ul>}
    </section>}
    {optedOut && <p role="status" className={styles.note}>This browser has opted out of analytics (Do Not Track or Global Privacy Control). Its board views and clicks are not counted.</p>}
    {preview && <section className={styles.panel} aria-label="Preview diagnostics">
      <h3>Preview diagnostics</h3>
      <p className={styles.note}>This dashboard only counts visits to this preview, not production. A synthetic test adds a board view and a detail open to the <code>preview-smoke</code> campaign. It does not record your browsing or open an application.</p>
      <form action={recordPreviewTest}><button className="button" type="submit">Run synthetic preview test</button></form>
      {test === "recorded" && <p role="status">Synthetic preview events recorded.</p>}
      {test === "failed" && <p role="alert">The synthetic test did not finish. Check the preview logs before retrying.</p>}
    </section>}
    {report ? <Report report={report} names={names} /> : <p role="status">Analytics are temporarily unavailable. No counts are shown.</p>}
  </section>;
}
