"use client";

import { useMemo, useState } from "react";
import { track } from "@vercel/analytics";
import {
  CATEGORIES,
  EXPERIENCES,
  LOCATIONS,
  RECENCY_OPTIONS,
  type JobView,
} from "../lib/jobs";

export default function JobBoard({ jobs }: { jobs: JobView[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [recency, setRecency] = useState("all");
  const [location, setLocation] = useState("All");
  const [experience, setExperience] = useState("All");

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const maxDays = RECENCY_OPTIONS.find((option) => option.value === recency)?.maxDays;
    return jobs.filter((job) => {
      if (text && !`${job.title} ${job.company}`.toLowerCase().includes(text)) return false;
      if (category !== "All" && job.category !== category) return false;
      if (maxDays !== undefined && job.daysAgo > maxDays) return false;
      if (location !== "All" && job.locationBucket !== location) return false;
      if (experience !== "All" && job.experienceBucket !== experience) return false;
      return true;
    });
  }, [jobs, query, category, recency, location, experience]);

  const hasFilters =
    query.trim() !== "" ||
    category !== "All" ||
    recency !== "all" ||
    location !== "All" ||
    experience !== "All";

  function clearFilters() {
    setQuery("");
    setCategory("All");
    setRecency("all");
    setLocation("All");
    setExperience("All");
  }

  return (
    <div>
      <section className="filters" aria-label="Filter jobs">
        <input
          className="search"
          type="search"
          placeholder="Search by role or company"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search jobs by role or company"
        />

        <div className="filter-group">
          <span className="filter-label">Posted</span>
          <div className="pills">
            <button
              type="button"
              className={recency === "all" ? "pill active" : "pill"}
              onClick={() => setRecency("all")}
            >
              All
            </button>
            {RECENCY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={recency === option.value ? "pill active" : "pill"}
                onClick={() => setRecency(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Category</span>
          <div className="pills">
            <button
              type="button"
              className={category === "All" ? "pill active" : "pill"}
              onClick={() => setCategory("All")}
            >
              All
            </button>
            {CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                className={category === value ? "pill active" : "pill"}
                onClick={() => setCategory(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <label className="select-wrap">
            <span className="filter-label">Location</span>
            <select value={location} onChange={(event) => setLocation(event.target.value)}>
              <option value="All">All locations</option>
              {LOCATIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="select-wrap">
            <span className="filter-label">Experience</span>
            <select
              value={experience}
              onChange={(event) => setExperience(event.target.value)}
            >
              <option value="All">All levels</option>
              {EXPERIENCES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <p className="result-count" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "job" : "jobs"}
        {hasFilters && (
          <button type="button" className="clear-btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>No jobs match these filters.</p>
          <p>Try clearing a filter, or check back later for new roles.</p>
        </div>
      ) : (
        <ul className="job-list">
          {filtered.map((job) => (
            <li key={job.id} className="job-card">
              <div className="job-head">
                <h2 className="job-title">{job.title}</h2>
                <span className="posted">{job.postedLabel}</span>
              </div>
              <p className="job-company">{job.company}</p>
              <p className="job-meta">
                {job.location} &middot; {job.experience} &middot; {job.category}
              </p>
              {job.salary && <p className="job-salary">{job.salary}</p>}
              <a
                className="apply-btn"
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  track("job_apply_click", { job: job.title, company: job.company })
                }
              >
                Apply on {job.source}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
