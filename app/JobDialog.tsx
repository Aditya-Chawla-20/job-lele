"use client";

import { useEffect, useRef } from "react";
import { recordAnalytics } from "../lib/analytics-client";
import { jobKeywords, type JobView } from "../lib/jobs";

type Props = {
  job: JobView;
  view: "details" | "keywords";
  onClose: () => void;
};

const keywordSource = {
  listing: "Keywords provided for this listing.",
  description: "Terms found in the job description.",
  title: "Terms from the role title and category.",
};

export default function JobDialog({ job, view, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const description = job.description?.trim();
  const descriptionSource = job.descriptionSourceUrl?.startsWith("https://")
    ? job.descriptionSourceUrl
    : undefined;
  const keywords = view === "keywords" ? jobKeywords(job) : null;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="job-dialog"
      aria-labelledby="dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <div>
            <h2 id="dialog-title">{job.title}</h2>
            <p className="job-company">{job.company}</p>
          </div>
          <form method="dialog">
            <button className="button" autoFocus>Close</button>
          </form>
        </div>
        <div className="dialog-body" tabIndex={0} aria-label={view === "details" ? "Job description" : "ATS keywords"}>
          <p className="job-meta">
            {job.location} · {job.experience} · <time dateTime={job.postedDate}>{job.postedLabel}</time>
            {job.salary && <> · {job.salary}</>}
          </p>
          {keywords ? (
            <>
              <h3>ATS keywords</h3>
              <p className="dialog-note">{keywordSource[keywords.source]} Use the terms that match your experience.</p>
              <ul className="keyword-list">
                {keywords.terms.map((term) => <li key={term}>{term}</li>)}
              </ul>
            </>
          ) : (
            <>
              <h3>Job description</h3>
              {description ? (
                <>
                  <p className="description-text">{description}</p>
                  {descriptionSource && (
                    <p className="dialog-note">
                      <a href={descriptionSource} target="_blank" rel="noopener noreferrer">
                        Read the source job posting
                      </a>
                    </p>
                  )}
                </>
              ) : (
                <p className="dialog-note">Open the original job listing for the full description.</p>
              )}
              <a className="button" href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => recordAnalytics("apply_click", job.id)}
                onAuxClick={(event) => { if (event.button === 1) recordAnalytics("apply_click", job.id); }}>
                {job.source === "job site" ? "Open job listing" : `Open on ${job.source}`}
              </a>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
