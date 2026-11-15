import json
from datetime import date
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from enrich_jobs import (
    extract_fields, fingerprint, source_description, update_jobs,
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
            patch("enrich_jobs.fetch_page", return_value=(URL, page(POSTING))) as fetch,
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
            fetch.assert_called_once()
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


if __name__ == "__main__":
    unittest.main()
