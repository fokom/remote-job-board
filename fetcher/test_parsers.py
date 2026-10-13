#!/usr/bin/env python3
"""Offline tests for the fetcher parsers (no network needed).

Run:  python3 fetcher/test_parsers.py
"""
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_jobs as fj  # noqa: E402

NOW = datetime.now(timezone.utc)


def days_ago(n):
    return (NOW - timedelta(days=n)).isoformat()


class HelperTests(unittest.TestCase):
    def test_strip_html_and_snippet_length(self):
        s = fj.strip_html("&lt;p&gt;Hello &amp; welcome&lt;/p&gt;<b>team</b>" + " word" * 200)
        self.assertTrue(s.startswith("Hello & welcome team"))
        self.assertLessEqual(len(s), fj.SNIPPET_LEN + 3)

    def test_same_job_same_id_ignoring_tracking(self):
        a = fj.job_id("https://Example.com/jobs/1/?utm_source=x#top")
        b = fj.job_id("https://example.com/jobs/1")
        self.assertEqual(a, b)

    def test_salary(self):
        self.assertEqual(fj.fmt_salary(80000, 120000, "USD", "year"), "$80,000 - $120,000 / year")
        self.assertEqual(fj.fmt_salary(0, 0), "")
        self.assertEqual(fj.fmt_salary(text="  $50/h  "), "$50/h")

    def test_remote_classification(self):
        self.assertEqual(fj.classify_remote("Worldwide")[0], "worldwide")
        self.assertEqual(fj.classify_remote("USA Only", force_remote=True)[0], "restricted")
        self.assertEqual(fj.classify_remote("Remote")[0], "worldwide")
        self.assertEqual(fj.classify_remote("Remote - Germany")[0], "restricted")
        self.assertEqual(fj.classify_remote("Berlin")[0], "unclear")
        self.assertEqual(fj.classify_remote("")[0], "unclear")

    def test_category_suggestions(self):
        self.assertIn("engineering", fj.suggest_categories("Senior Backend Engineer"))
        self.assertIn("customer-support", fj.suggest_categories("Customer Support Specialist"))
        self.assertNotIn("engineering", fj.suggest_categories("Support Engineer"))
        self.assertIn("project-management", fj.suggest_categories("Project Manager"))
        self.assertIn("architecture", fj.suggest_categories("Solutions Architect"))
        self.assertIn("gigs", fj.suggest_categories("Freelance Logo Designer"))

    def test_rejects_jobs_without_a_valid_link(self):
        self.assertIsNone(fj.make_job("Title", "Co", "not-a-url", "S", "https://s"))
        self.assertIsNone(fj.make_job("", "Co", "https://x.com/1", "S", "https://s"))


class PopularSourceTests(unittest.TestCase):
    def test_remotive(self):
        data = {"jobs": [{
            "title": "Customer Support Agent", "company_name": "Acme", "url": "https://remotive.com/remote-jobs/1",
            "salary": "$30k - $40k", "candidate_required_location": "Worldwide", "publication_date": "2026-10-10T08:00:00",
            "category": "Customer Service", "tags": ["support"], "job_type": "full_time", "description": "<p>Help customers</p>"}]}
        j = fj.parse_remotive(data)[0]
        self.assertEqual((j["title"], j["company"], j["source"]), ("Customer Support Agent", "Acme", "Remotive"))
        self.assertEqual(j["salary"], "$30k - $40k")
        self.assertEqual(j["remote_status"], "worldwide")
        self.assertEqual(j["job_type"], "full time")
        self.assertIn("customer-support", j["categories"])
        self.assertTrue(j["posted_at"].startswith("2026-10-10"))

    def test_remoteok_skips_legal_row(self):
        data = [{"legal": "attribution required"},
                {"id": "1", "position": "Rust Developer", "company": "Foo", "url": "https://remoteok.com/remote-jobs/rust-1",
                 "salary_min": 100000, "salary_max": 150000, "location": "Worldwide", "date": "2026-10-11T10:00:00+00:00",
                 "tags": ["rust", "backend"], "description": "<p>Build things</p>"}]
        jobs = fj.parse_remoteok(data)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["salary"], "$100,000 - $150,000 / year")
        self.assertIn("engineering", jobs[0]["categories"])

    def test_arbeitnow_only_remote(self):
        data = {"data": [
            {"title": "Dev", "company_name": "A", "url": "https://arbeitnow.com/jobs/a", "remote": True,
             "location": "Berlin", "created_at": 1760000000, "tags": [], "job_types": ["full time"], "description": ""},
            {"title": "Onsite", "company_name": "B", "url": "https://arbeitnow.com/jobs/b", "remote": False,
             "location": "Munich", "created_at": 1760000000, "description": ""}]}
        jobs = fj.parse_arbeitnow(data)
        self.assertEqual([j["title"] for j in jobs], ["Dev"])
        self.assertEqual(jobs[0]["remote_status"], "restricted")

    def test_jobicy(self):
        data = {"jobs": [{"jobTitle": "Project Manager", "companyName": "Zed", "url": "https://jobicy.com/jobs/9",
                          "jobGeo": "Europe", "jobIndustry": ["Management"], "jobType": ["Full-Time"],
                          "annualSalaryMin": 60000, "annualSalaryMax": 80000, "salaryCurrency": "EUR",
                          "pubDate": "2026-10-09 10:00:00", "jobExcerpt": "Lead projects"}]}
        j = fj.parse_jobicy(data)[0]
        self.assertEqual(j["salary"], "€60,000 - €80,000 / year")
        self.assertEqual(j["remote_status"], "restricted")
        self.assertIn("project-management", j["categories"])

    def test_weworkremotely_rss(self):
        xml = b"""<?xml version="1.0"?><rss><channel><item>
            <title>Initech: Senior DevOps Engineer</title>
            <region>Anywhere in the World</region><category>DevOps</category>
            <link>https://weworkremotely.com/remote-jobs/initech-devops</link>
            <pubDate>Fri, 10 Oct 2026 12:00:00 +0000</pubDate>
            <description>&lt;p&gt;Run our clusters&lt;/p&gt;</description></item></channel></rss>"""
        j = fj.parse_wwr(xml)[0]
        self.assertEqual((j["company"], j["title"]), ("Initech", "Senior DevOps Engineer"))
        self.assertEqual(j["remote_status"], "worldwide")
        self.assertIn("devops", j["categories"])
        self.assertTrue(j["posted_at"].startswith("2026-10-10"))


class CompanySiteTests(unittest.TestCase):
    SITE = {"name": "Acme", "url": "https://boards.greenhouse.io/acme", "all_remote": False}

    def test_detect_type(self):
        self.assertEqual(fj.detect_site_type("https://boards.greenhouse.io/acme"), ("greenhouse", "acme"))
        self.assertEqual(fj.detect_site_type("https://job-boards.greenhouse.io/acme"), ("greenhouse", "acme"))
        self.assertEqual(fj.detect_site_type("https://jobs.lever.co/acme"), ("lever", "acme"))
        self.assertEqual(fj.detect_site_type("https://jobs.ashbyhq.com/acme"), ("ashby", "acme"))
        self.assertEqual(fj.detect_site_type("https://apply.workable.com/acme/"), ("workable", "acme"))
        self.assertEqual(fj.detect_site_type("https://acme.com/careers/feed.xml")[0], "rss")
        self.assertEqual(fj.detect_site_type("https://acme.com/careers")[0], "html")

    def test_greenhouse_filters_remote(self):
        data = {"jobs": [
            {"title": "Backend Engineer", "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
             "location": {"name": "Remote, US"}, "first_published": "2026-10-08T10:00:00Z", "content": "&lt;p&gt;Go&lt;/p&gt;"},
            {"title": "Office Manager", "absolute_url": "https://boards.greenhouse.io/acme/jobs/2",
             "location": {"name": "Paris"}, "updated_at": "2026-10-08T10:00:00Z"}]}
        jobs = fj.parse_greenhouse(data, self.SITE)
        self.assertEqual([j["title"] for j in jobs], ["Backend Engineer"])
        self.assertEqual(jobs[0]["remote_status"], "restricted")
        all_remote = dict(self.SITE, all_remote=True)
        self.assertEqual(len(fj.parse_greenhouse(data, all_remote)), 2)

    def test_lever(self):
        data = [{"text": "Support Lead", "hostedUrl": "https://jobs.lever.co/acme/abc", "workplaceType": "remote",
                 "categories": {"location": "Remote", "team": "Support", "commitment": "Full-time"},
                 "createdAt": 1760000000000, "descriptionPlain": "Lead the team",
                 "salaryRange": {"min": 70000, "max": 90000, "currency": "USD", "interval": "per-year-salary"}},
                {"text": "On-site role", "hostedUrl": "https://jobs.lever.co/acme/def", "workplaceType": "on-site",
                 "categories": {"location": "Austin"}}]
        jobs = fj.parse_lever(data, dict(self.SITE, url="https://jobs.lever.co/acme"))
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["salary"], "$70,000 - $90,000 / year")
        self.assertEqual(jobs[0]["remote_status"], "worldwide")

    def test_ashby(self):
        data = {"jobs": [{"title": "Designer", "jobUrl": "https://jobs.ashbyhq.com/acme/1", "isRemote": True,
                          "location": "Remote - Europe", "publishedAt": "2026-10-07T09:00:00.000+00:00",
                          "descriptionPlain": "Design things", "department": "Design", "employmentType": "FullTime"},
                         {"title": "Hidden", "jobUrl": "https://jobs.ashbyhq.com/acme/2", "isListed": False, "isRemote": True}]}
        jobs = fj.parse_ashby(data, dict(self.SITE, url="https://jobs.ashbyhq.com/acme"))
        self.assertEqual([j["title"] for j in jobs], ["Designer"])
        self.assertIn("design", jobs[0]["categories"])

    def test_workable(self):
        data = {"jobs": [{"title": "Content Writer", "url": "https://apply.workable.com/acme/j/1", "telecommuting": True,
                          "country": "Canada", "published_on": "2026-10-06"}]}
        jobs = fj.parse_workable(data, dict(self.SITE, url="https://apply.workable.com/acme"))
        self.assertEqual(len(jobs), 1)
        self.assertIn("writing", jobs[0]["categories"])

    def test_html_json_ld(self):
        page = """<html><head><script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Remote QA Engineer",
         "datePosted":"2026-10-05","jobLocationType":"TELECOMMUTE","url":"/careers/qa-engineer",
         "hiringOrganization":{"@type":"Organization","name":"Acme Inc"},
         "baseSalary":{"@type":"MonetaryAmount","currency":"USD","value":{"@type":"QuantitativeValue","minValue":50000,"maxValue":70000,"unitText":"YEAR"}}}
        </script></head><body></body></html>"""
        site = {"name": "Acme", "url": "https://acme.com/careers", "all_remote": False}
        j = fj.parse_html_site(page, site)[0]
        self.assertEqual((j["title"], j["company"]), ("Remote QA Engineer", "Acme Inc"))
        self.assertEqual(j["link"], "https://acme.com/careers/qa-engineer")
        self.assertEqual(j["salary"], "$50,000 - $70,000 / year")

    def test_html_link_fallback(self):
        page = """<ul>
          <li><a href="/jobs/123-remote-support-agent">Remote Support Agent</a></li>
          <li><a href="/jobs/124-office-chef">Office Chef</a></li>
          <li><a href="/careers">Careers</a></li></ul>"""
        site = {"name": "Acme", "url": "https://acme.com/careers", "all_remote": False}
        jobs = fj.parse_html_site(page, site)
        self.assertEqual([j["title"] for j in jobs], ["Remote Support Agent"])
        site_all = dict(site, all_remote=True)
        self.assertEqual(len(fj.parse_html_site(page, site_all)), 2)


class MergeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.orig = fj.DATA
        fj.DATA = Path(self.tmp.name)
        for name in ("pending", "pool", "published", "rejected"):
            (fj.DATA / (name + ".json")).write_text("[]")

    def tearDown(self):
        fj.DATA = self.orig
        self.tmp.cleanup()

    def job(self, n, posted=None):
        return fj.make_job("Job %d" % n, "Co", "https://x.com/jobs/%d" % n, "S", "https://x.com",
                           posted_at=posted or days_ago(1), force_remote=True)

    def test_dedupes_and_skips_known_and_old(self):
        (fj.DATA / "rejected.json").write_text(json.dumps([self.job(2)["id"]]))
        (fj.DATA / "published.json").write_text(json.dumps([self.job(3)]))
        batch = [self.job(1), self.job(1), self.job(2), self.job(3), self.job(4, posted=days_ago(90))]
        added, dupes, too_old, total = fj.merge_into_pending(batch, 30)
        self.assertEqual((added, too_old, total), (1, 1, 1))
        self.assertEqual(dupes, 3)
        added2, *_ = fj.merge_into_pending(batch, 30)
        self.assertEqual(added2, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
