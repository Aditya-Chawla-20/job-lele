"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JobDialog from "./JobDialog";
import { track } from "@vercel/analytics";
import {
  CATEGORIES,
  EXPERIENCES,
  LOCATIONS,
  RECENCY_OPTIONS,
  type JobView,
} from "../lib/jobs";

const PAGE_SIZE = 18;

export default function JobBoard({ jobs }: { jobs: JobView[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [recency, setRecency] = useState("all");
  const [location, setLocation] = useState("All");
  const [experience, setExperience] = useState("All");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState<{
    job: JobView;
    view: "details" | "keywords";
    trigger: HTMLButtonElement;
  } | null>(null);

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

  const moreFiltersCount = Number(recency !== "all") + Number(location !== "All") + Number(experience !== "All");

  const hasFilters =
    query.trim() !== "" ||
    category !== "All" ||
    recency !== "all" ||
    location !== "All" ||
    experience !== "All";

  const canLoadMore = !hasFilters && visibleCount < filtered.length;
  const visible = hasFilters ? filtered : filtered.slice(0, visibleCount);

  useEffect(() => {
    const button = loadMoreRef.current;
    if (!canLoadMore || !button || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setVisibleCount((count) => count + PAGE_SIZE);
    }, { rootMargin: "200px 0px" });
    observer.observe(button);
    return () => observer.disconnect();
  }, [canLoadMore, visibleCount]);

  function clearFilters() {
    setQuery("");
    setCategory("All");
    setRecency("all");
    setLocation("All");
    setExperience("All");
  }

  return (
    <div className="jobs-column">
      <section className="filters" aria-label="Filter jobs">
        <div className="search-field">
          <label className="filter-label" htmlFor="job-search">Search jobs</label>
          <div className="search-control">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              id="job-search"
              className="search"
              type="search"
              placeholder="Search by role or company"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label" id="category-filter">Category</span>
          <div className="pills" role="group" aria-labelledby="category-filter">
            <button
              type="button"
              aria-pressed={category === "All"}
              className="pill"
              onClick={() => setCategory("All")}
            >
              All
            </button>
            {CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                className="pill"
                onClick={() => setCategory(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="button more-filters-toggle"
          aria-expanded={moreFiltersOpen}
          aria-controls="job-more-filters"
          onClick={() => setMoreFiltersOpen((open) => !open)}
        >
          {moreFiltersOpen ? "Fewer filters" : "More filters"}
          {moreFiltersCount > 0 ? ` (${moreFiltersCount} active)` : ""}
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 8 5 5 5-5" />
          </svg>
        </button>
        <div id="job-more-filters" className="filter-row" data-expanded={moreFiltersOpen}>
          <label className="select-wrap">
            <span className="filter-label">Posted</span>
            <select value={recency} onChange={(event) => setRecency(event.target.value)}>
              <option value="all">Any time</option>
              {RECENCY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
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

      <div className="result-count">
        <span role="status">{filtered.length} {filtered.length === 1 ? "job" : "jobs"}</span>
        {hasFilters && (
          <button type="button" className="clear-btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>No jobs match these filters.</p>
          <p>Try clearing a filter, or check back later for new roles.</p>
        </div>
      ) : (
        <>
          <ul className="job-list">
            {visible.map((job) => (
              <li key={job.id} className="job-card">
                <h2 className="job-title">{job.title}</h2>
                <p className="job-company">{job.company}</p>
                <ul className="job-meta job-facts" aria-label="Job information">
                  <li>{job.location}</li>
                  <li>{job.experience}</li>
                  <li><time dateTime={job.postedDate}>{job.postedLabel}</time></li>
                  {job.salary && <li>{job.salary}</li>}
                </ul>
                <span className="job-category">{job.category}</span>
                {job.description?.trim() && <p className="job-preview">{job.description.trim()}</p>}
                <div className="job-actions">
                  <button
                    type="button"
                    className="button"
                    aria-haspopup="dialog"
                    onClick={(event) => setSelection({ job, view: "details", trigger: event.currentTarget })}
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    className="button"
                    aria-haspopup="dialog"
                    onClick={(event) => setSelection({ job, view: "keywords", trigger: event.currentTarget })}
                  >
                    Keywords
                  </button>
                  <a
                    className="button button-primary"
                    href={job.applyUrl}
                    aria-label={`Apply on ${job.source}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track("job_apply_click", { job: job.title, company: job.company })}
                  >
                    Apply
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {canLoadMore && (
            <button
              ref={loadMoreRef}
              type="button"
              className="button load-more-jobs"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              Load more jobs
            </button>
          )}
        </>
      )}
      {selection && (
        <JobDialog
          job={selection.job}
          view={selection.view}
          onClose={() => {
            setSelection(null);
            selection.trigger.focus();
          }}
        />
      )}
    </div>
  );
}
