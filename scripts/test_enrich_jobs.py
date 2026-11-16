import json
from datetime import date
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from enrich_jobs import (
    extract_fields, fingerprint, source_description, source_url_allowed, update_jobs,
)


TODAY = date(2026, 11, 15)
URL = "https://job-boards.greenhouse.io/example/jobs/123"
JOB = {
    "id": "linkedin-123",
    "title": "Junior Software Engineer",
    "company": "Example Labs",
    "location": "Pune",
    "postedDate": "2026-11-14",
    "applyUrl": "https://www.linkedin.com/jobs/view/123/",
}
TEXT = (
    "Develop backend services using Python, PostgreSQL and Docker. "
    "Write integration tests and help improve our continuous integration workflows."
)
SUMMARY = "Build backend services, contribute integration tests, and help improve continuous integration."
POSTING = {
    "@type": "JobPosting",
    "title": JOB["title"],
    "hiringOrganization": {"name": JOB["company"]},
    "jobLocation": {"address": {"addressLocality": "Pune", "addressCountry": "IN"}},
    "datePosted": "2026-11-14",
    "description": f"<p>{TEXT}</p>",
}


def page(posting):
    return f'<script type="application/ld+json">{json.dumps({"@graph": [posting]})}</script>'


def linkedin_page(job_id="123"):
    return (
        f'<link rel="canonical" href="https://in.linkedin.com/jobs/view/example-{job_id}">'
        '<meta property="og:title" content="Junior Software Engineer at Example Labs | LinkedIn Jobs">'
        f'<div class="show-more-less-html__markup"><p>{TEXT}</p></div>'
    )


class EnrichmentTest(unittest.TestCase):
    def test_matches_open_employer_job_and_rejects_wrong_role_location_and_expired_job(self):
        self.assertEqual(source_description(page(POSTING), JOB, TODAY, True), TEXT)
        for changes in (
            {"title": "Senior Software Engineer"},
            {"jobLocation": {"address": {"addressLocality": "Boston"}}},
            {"hiringOrganization": {"name": "Other employer"}},
            {"validThrough": "2026-11-13"},
        ):
            self.assertIsNone(source_description(page(POSTING | changes), JOB, TODAY, True))

    def test_gemini_failure_uses_nvidia_and_filters_terms_against_source(self):
        response = {
            "choices": [{"message": {"content": json.dumps(
                {"description": SUMMARY, "keywords": ["Python", "python", "PostgreSQL", "Kubernetes", 72]}
            )}}]
        }
        with patch("enrich_jobs.post_json", side_effect=[
            HTTPError("https://example.test", 429, "", {}, None), response,
        ]) as post:
            self.assertEqual(extract_fields(TEXT, True, "gemini-test", "nvidia-test"), (SUMMARY, ["Python", "PostgreSQL"]))
        self.assertIn("generativelanguage.googleapis.com", post.call_args_list[0].args[0])
        self.assertIn("integrate.api.nvidia.com", post.call_args_list[1].args[0])

    def test_enrichment_round_trip_and_idempotence(self):
        with (
            patch("enrich_jobs.discover_source", return_value=URL) as discover,
            patch("enrich_jobs.fetch_page", side_effect=[
                HTTPError(JOB["applyUrl"], 403, "", {}, None), (URL, page(POSTING)),
            ]) as fetch,
            patch("enrich_jobs.gemini", return_value=json.dumps({"description": SUMMARY, "keywords": ["Docker"]})),
        ):
            updated = update_jobs([JOB], {}, TODAY, "gemini-test", None)
            entry = updated[JOB["id"]]
            self.assertEqual(entry["fingerprint"], fingerprint(JOB))
            self.assertEqual(entry["description"], SUMMARY)
            self.assertEqual(entry["keywords"], ["Docker"])
            self.assertEqual(entry["descriptionSourceUrl"], URL)
            self.assertEqual(update_jobs([JOB], updated, TODAY, "gemini-test", None), updated)
            discover.assert_called_once()
            self.assertEqual(fetch.call_count, 2)
        self.assertEqual(update_jobs([JOB], updated, date(2026, 11, 22), None, None), {})
        self.assertNotEqual(fingerprint(JOB), fingerprint(JOB | {"location": "Mumbai"}))

    def test_muse_text_wins_and_does_not_fetch_again(self):
        supplied = JOB | {"description": TEXT}
        with (
            patch("enrich_jobs.fetch_page") as fetch,
            patch("enrich_jobs.gemini", return_value='{"description":"","keywords":["Python"]}'),
        ):
            entry = update_jobs([supplied], {}, TODAY, "gemini-test", None)[JOB["id"]]
            self.assertEqual(entry["keywords"], ["Python"])
            self.assertNotIn("description", entry)
            fetch.assert_not_called()

    def test_reads_exact_linkedin_job_before_search(self):
        canonical = "https://in.linkedin.com/jobs/view/example-123"
        with (
            patch("enrich_jobs.fetch_page", return_value=(canonical, linkedin_page())) as fetch,
            patch("enrich_jobs.discover_source") as discover,
            patch("enrich_jobs.extract_fields", return_value=(SUMMARY, ["Python"])) as extract,
        ):
            entry = update_jobs([JOB], {}, TODAY, "gemini-test", "nvidia-test")[JOB["id"]]
            self.assertEqual(entry["descriptionSourceUrl"], canonical)
            fetch.assert_called_once_with(JOB["applyUrl"], False)
            discover.assert_not_called()
            extract.assert_called_once_with(TEXT, True, "gemini-test", "nvidia-test")

    def test_direct_job_urls_do_not_allow_search_or_other_jobs(self):
        self.assertTrue(source_url_allowed(JOB["applyUrl"]))
        self.assertTrue(source_url_allowed("https://www.naukri.com/job-listings-example-123"))
        self.assertFalse(source_url_allowed(JOB["applyUrl"], discovered=True))
        self.assertFalse(source_url_allowed("https://www.linkedin.com/login"))
        self.assertIsNone(source_description(linkedin_page("456"), JOB, TODAY, False, JOB["applyUrl"]))
        self.assertIsNone(source_description(
            linkedin_page() + page(POSTING | {"validThrough": "2026-11-13"}),
            JOB, TODAY, False, JOB["applyUrl"],
        ))


if __name__ == "__main__":
    unittest.main()
