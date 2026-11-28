import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { signedInOwner } from "../../../lib/analytics-server";
import { jobsPublishingEnabled } from "../../../lib/published-jobs";
import { queueLabel, queueStates, readQueue, type QueueJob } from "../../../lib/sourcing-queue";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sourcing queue | Job Lele", robots: { index: false, follow: false }, referrer: "same-origin" };
const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const messages: Record<string, string> = {
  added: "Added to the queue.", saved: "Status saved.", reserved: "Reserved for 30 minutes.",
  review: "Added. Another job has this company and title; check both before reserving.",
  duplicate: "This application link or employer requisition is already in the queue. Its status was preserved.",
  identity_conflict: "The requisition and application link conflict with an existing record. Review before using either role.",
  unavailable: "Nothing changed. This job was already updated or claimed; use its current status.",
  invalid: "Nothing changed. Check your fields and use a public HTTPS application or X post link.",
  failed: "The update could not be confirmed. Check the queue before retrying.",
};

function Action({ job, action, label, evidence }: { job: QueueJob; action: string; label: string; evidence?: "receipt" | "link" }) {
  return <form className={styles.form} action="/api/admin/queue" method="post">
    <input type="hidden" name="action" value={action} /><input type="hidden" name="id" value={job.id} />
    {job.batch_id && <input type="hidden" name="batch" value={job.batch_id} />}
    {evidence && <label>{evidence === "receipt" ? "Muse receipt or reference" : "Live X post link (optional)"}
      <input name="evidence" type={evidence === "link" ? "url" : "text"} maxLength={300} required={evidence === "receipt"} />
    </label>}
    <button type="submit" className="button">{label}</button>
  </form>;
}

export default async function Queue({searchParams}: {searchParams: Promise<{ state?: string; result?: string; before?: string }>}) {
  if (!jobsPublishingEnabled()) notFound();
  if (!await signedInOwner()) redirect("/admin");
  const { state: raw, result, before } = await searchParams;
  const state = queueStates.find((item) => item === raw);
  const cursor = before && /^[1-9]\d{0,8}$/.test(before) ? before : undefined;
  let fetched: QueueJob[] | null = null;
  try { fetched = await readQueue(state, cursor); } catch { /* Keep other admin functions independent. */ }
  const rows = fetched?.slice(0,30);
  return <section className={styles.dashboard} aria-labelledby="queue-title">
    <div className={styles.heading}><div><a href="/admin">← Job Lele admin</a><h2 id="queue-title">Sourcing queue</h2></div></div>
    <p className={styles.note}>Private preview. This tracks sourcing and X handoffs; it does not publish to X or add jobs to the public board.</p>
    {result && Object.hasOwn(messages, result) && <p role="status">{messages[result]}</p>}
    <section className={styles.panel} aria-labelledby="add-job">
      <h3 id="add-job">Collect a job</h3>
      <form className={styles.form} method="post" action="/api/admin/queue">
        <input type="hidden" name="action" value="add" />
        <div className={styles.grid}>
          <label>Company<input name="company" required maxLength={100} /></label>
          <label>Job title<input name="title" required maxLength={150} /></label>
          <label>Location<input name="location" required maxLength={100} /></label>
          <label>Eligibility or experience<input name="experience" required maxLength={100} /></label>
          <label>Employer requisition (optional)<input name="requisition" maxLength={100} /></label>
          <label>Original date (optional)<input name="date" type="date" /></label>
        </div>
        <label>Public Apply link<input name="url" type="url" required maxLength={2048} /></label>
        <button type="submit" className="button button-primary">Add to queue</button>
      </form>
    </section>
    <section className={styles.panel} aria-labelledby="queue-list">
      <h3 id="queue-list">Jobs by status</h3>
      <form method="get" className={styles.form}>
        <label>Status<select name="state" defaultValue={state ?? ""}><option value="">All statuses</option>
          {queueStates.map((value) => <option key={value} value={value}>{queueLabel[value]}</option>)}
        </select></label><button type="submit" className="button">Filter</button>
      </form>
      {!rows ? <p role="status">The queue is temporarily unavailable.</p> : rows.length === 0 ? <p>No jobs in this view.</p> :
        <div className={styles.scroll} role="region" aria-label="Sourcing queue jobs" tabIndex={0}>
          <table><thead><tr><th scope="col">Job</th><th scope="col">Eligibility</th><th scope="col">Status and evidence</th><th scope="col">Actions</th></tr></thead>
            <tbody>{rows.map((j) => <tr key={j.id}>
              <th scope="row">{j.title}<br />{j.company}<br /><a href={j.apply_url} rel="noreferrer">Apply listing</a>{j.requisition && <><br /><small>{j.requisition}</small></>}</th>
              <td>{j.location}<br />{j.experience}{j.posted_date && <><br />Posted {j.posted_date}</>}</td>
              <td>{queueLabel[j.state]}
                {j.reserved_until && <><br /><small>Until {time.format(new Date(j.reserved_until))} IST</small></>}
                {j.handoff_receipt && <><br /><small>{j.handoff_receipt}</small></>}
                {j.publication_basis && <><br />{j.publication_basis === "link_confirmed" ? "Live link independently checked" : "Owner reported"}</>}
                {j.x_post_url && <><br /><a href={j.x_post_url} rel="noreferrer">View X post</a></>}
              </td>
              <td>
                {j.state === "collected" && <Action job={j} action="verify" label="Mark verified" />}
                {(j.state === "verified" || (j.state === "reserved" && !!j.reserved_until && Date.parse(j.reserved_until) <= Date.now())) && <Action job={j} action="reserve" label="Reserve" />}
                {j.state === "reserved" && <><Action job={j} action="release" label="Release" /><Action job={j} action="sent" label="Record Muse handoff" evidence="receipt" /></>}
                {j.state !== "posted" && <Action job={j} action="owner_posted" label="Record as posted" evidence="link" />}
              </td>
            </tr>)}</tbody>
          </table>
        </div>}
      {fetched?.length === 31 && <a href={"/admin/queue?before=" + fetched[29].sequence_no + (state ? "&state=" + state : "")}>Next page →</a>}
    </section>
  </section>;
}
