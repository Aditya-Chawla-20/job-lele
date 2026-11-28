# Job Lele sourcing queue (preview only)

Use the owner-authenticated `/admin/queue` to add, verify and filter listings; reserve a role for 30 minutes; record an observed Muse handoff; or record the owner's report that a job was posted. None of these actions delivers a message, publishes on X, or updates the public board. A live post link provided by the owner is still an owner report until independently verified.

Apply the migration only to the isolated Job Lele Preview project. No access is granted to anon/authenticated users. App code uses the existing server-side service role; the role can read the queue and invoke the restricted functions, but cannot directly edit/delete queue rows. Owner access is re-checked on each request and cross-origin writes are rejected.

Trusted sourcing client flow:

1. Call `joblele_queue_intake` with public job data only. Use the real employer or ATS requisition ID when visible, omit the date if exact original date is unknown. Reusing an exact URL or employer/requisition returns the existing row (with current status) and does not reset it. A newly seen URL for the same requisition becomes an alias. Conflicting identifiers and potential same-company/title matches require review; do not automatically reserve them. Normalize employer naming consistently, and compare historical records before handoff.
2. Call `joblele_queue_move(id, 'verify', null, null)` once eligibility, date window and public Apply have been checked.
3. Reserve a two- or three-job draft atomically with `joblele_queue_reserve(ids)`. Only send if the function returns a batch ID. Every claim in the request succeeds or none does. If no send occurs, release your reservation; a stale one can be reclaimed after 30 minutes only after checking whether a prior send completed. If the outcome is uncertain, check Muse and do not blindly resend.
4. Record `sent` for each reserved job with batch ID and a stable Muse receipt/reference, only after observing actual delivery. Where possible use one database transaction for all jobs in the bundle. Do not make a second send as a way of repairing a bookkeeping failure.
5. The owner UI records `owner_posted`. Only trusted operators should use `confirm_post` after independently opening and matching a live top-level X post link to the role. This action requires the canonical public X status URL, and can upgrade an owner report. Neither arrival in Muse nor a suggested slot is publication.

This queue has no access to private job-search correspondence, and uses no production resources. Apply URLs should never carry session or applicant parameters.
