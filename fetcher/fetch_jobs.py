#!/usr/bin/env python3
"""
Fetch remote jobs from popular public sources and from your own list of
company career sites, then add anything new to data/pending.json so you can
review it in the admin UI.

Standard library only: no pip install needed.

Usage:
    python3 fetcher/fetch_jobs.py                  # everything
    python3 fetcher/fetch_jobs.py --only remotive,remoteok
    python3 fetcher/fetch_jobs.py --skip-sites     # popular sources only
    python3 fetcher/fetch_jobs.py --skip-sources   # company sites only
    python3 fetcher/fetch_jobs.py --max-age-days 14
"""
import argparse
import hashlib
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Identify yourself politely. Put a real contact e-mail or site here.
USER_AGENT = "RemoteJobBoardBot/1.0 (personal job board; contact: you@example.com)"
TIMEOUT = 25
SNIPPET_LEN = 280
PENDING_MAX_AGE_DAYS = 21  # unreviewed jobs older than this are dropped
PENDING_MAX_ITEMS = 3000


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def log(msg):
    print(msg, flush=True)


def http_get(url, accept="application/json, text/html;q=0.9, */*;q=0.8"):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def http_json(url):
    return json.loads(http_get(url).decode("utf-8", errors="replace"))


def strip_html(text, limit=SNIPPET_LEN):
    """Turn (possibly escaped) HTML into a short plain-text snippet."""
    if not text:
        return ""
    text = html.unescape(str(text))
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0].rstrip(",.;:- ") + "..."
    return text


TRACKING_PARAMS = {"utm_source", "utm_medium", "utm_campaign", "utm_term",
                   "utm_content", "ref", "source", "gh_src", "lever-source"}


def normalize_link(link):
    try:
        p = urlparse(link.strip())
        query = [(k, v) for k, v in parse_qsl(p.query)
                 if k.lower() not in TRACKING_PARAMS]
        path = p.path.rstrip("/") or "/"
        return urlunparse((p.scheme.lower(), p.netloc.lower(), path, "",
                           urlencode(query), ""))
    except Exception:
        return link.strip()


def job_id(link):
    return hashlib.sha1(normalize_link(link).encode("utf-8")).hexdigest()[:12]


def to_iso(value):
    """Best-effort conversion of many date formats to an ISO UTC string."""
    if value in (None, ""):
        return ""
    try:
        if isinstance(value, (int, float)):
            seconds = value / 1000.0 if value > 1e11 else float(value)
            return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat()
        s = str(value).strip()
        if re.fullmatch(r"\d{9,13}", s):
            return to_iso(int(s))
        s2 = s.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s2)
        except ValueError:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return ""


def fmt_salary(low=None, high=None, currency="", period="", text=""):
    """Return a readable salary string, or '' when unknown."""
    if text and str(text).strip():
        return str(text).strip()

    def num(x):
        try:
            x = float(x)
            return x if x > 0 else None
        except (TypeError, ValueError):
            return None

    lo, hi = num(low), num(high)
    if lo is None and hi is None:
        return ""
    sym = {"USD": "$", "EUR": "€", "GBP": "£", "": "$"}.get((currency or "").upper(), "")
    code = "" if sym else (currency or "").upper() + " "

    def f(x):
        return "{}{}{:,.0f}".format(sym, code, x)

    out = f(lo) if hi is None or lo == hi else (f(hi) if lo is None else "{} - {}".format(f(lo), f(hi)))
    if period:
        out += " / " + period
    return out


WORLDWIDE_RE = re.compile(r"\b(worldwide|anywhere|global|globally|world[- ]?wide|any location|everywhere|work from anywhere)\b", re.I)
REMOTE_RE = re.compile(r"\b(remote|remotely|work from home|wfh|telecommut\w*|distributed)\b", re.I)


def is_remote_text(*parts):
    return bool(REMOTE_RE.search(" ".join(p for p in parts if p)))


def classify_remote(location, force_remote=False):
    """Return (remote_status, location_label)."""
    loc = (location or "").strip()
    if not loc:
        return ("worldwide" if force_remote else "unclear"), ("Remote" if force_remote else "")
    if WORLDWIDE_RE.search(loc):
        return "worldwide", loc
    leftover = REMOTE_RE.sub("", loc)
    leftover = re.sub(r"[\W_]+", " ", leftover).strip()
    if force_remote or REMOTE_RE.search(loc):
        return ("worldwide" if not leftover else "restricted"), loc
    return "unclear", loc


CATEGORY_HINTS = {
    "engineering": ["engineer", "developer", "programmer", "software", "backend", "back-end", "frontend", "front-end", "full stack", "full-stack", "fullstack", "mobile", "ios", "android", "python", "javascript", "react", "node", "golang", "rust", "java ", "qa ", "sdet"],
    "customer-support": ["support", "customer success", "customer service", "customer care", "helpdesk", "help desk", "customer experience", "technical support", "client success"],
    "project-management": ["project manager", "program manager", "scrum", "delivery manager", "project management", "agile coach", "project coordinator"],
    "architecture": ["architect"],
    "gigs": ["freelance", "contract", "gig", "part-time", "part time", "temporary", "contractor", "per hour", "hourly"],
    "design": ["designer", "design ", "ux", "ui ", "graphic", "illustrat", "figma", "creative director", "brand design"],
    "marketing": ["marketing", "seo", "growth", "social media", "community manager", "content marketing", "demand gen", "paid media", "email marketing"],
    "sales": ["sales", "account executive", "business development", "sdr", "bdr", "account manager", "partnerships"],
    "data": ["data scientist", "data analyst", "data engineer", "machine learning", "ml engineer", "analytics", "business intelligence", "bi analyst", "ai engineer", "data science"],
    "product": ["product manager", "product owner", "product lead", "head of product", "product management"],
    "writing": ["writer", "copywriter", "editor", "content writer", "technical writer", "content creator", "journalist", "translator"],
    "devops": ["devops", "sre", "site reliability", "infrastructure", "platform engineer", "cloud engineer", "kubernetes", "sysadmin", "system administrator", "security engineer"],
    "finance": ["accountant", "accounting", "finance", "bookkeeper", "financial", "controller", "payroll", "fp&a", "tax "],
    "hr": ["recruiter", "recruiting", "talent", "human resources", "people operations", "hr ", "people partner"],
}


def suggest_categories(title, tags=(), source_category=""):
    hay = " {} {} {} ".format(title or "", " ".join(tags or []), source_category or "").lower()
    found = []
    for slug, words in CATEGORY_HINTS.items():
        if any(w in hay for w in words):
            found.append(slug)
    # "support engineer" is support, not generic engineering
    if "customer-support" in found and "engineering" in found and "support engineer" in hay:
        found.remove("engineering")
    return found[:3] if found else []


def make_job(title, company, link, source, source_url, location="", salary="",
             posted_at="", description="", tags=None, source_category="",
             job_type="", force_remote=False):
    title = re.sub(r"\s+", " ", html.unescape(title or "")).strip()
    link = (link or "").strip()
    if not title or not link.lower().startswith(("http://", "https://")):
        return None
    status, loc_label = classify_remote(location, force_remote=force_remote)
    return {
        "id": job_id(link),
        "title": title,
        "company": re.sub(r"\s+", " ", html.unescape(company or "")).strip() or "Unknown company",
        "link": link,
        "salary": salary or "",
        "remote_status": status,
        "location": loc_label,
        "job_type": job_type or "",
        "source": source,
        "source_url": source_url,
        "posted_at": to_iso(posted_at),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "description": strip_html(description),
        "categories": suggest_categories(title, tags or [], source_category),
    }


# --------------------------------------------------------------------------
# popular sources (parse_* functions are pure so they can be tested offline)
# --------------------------------------------------------------------------

def parse_remotive(data):
    out = []
    for j in (data or {}).get("jobs", []):
        out.append(make_job(
            j.get("title"), j.get("company_name"), j.get("url"),
            "Remotive", "https://remotive.com",
            location=j.get("candidate_required_location") or "Worldwide",
            salary=fmt_salary(text=j.get("salary")),
            posted_at=j.get("publication_date"), description=j.get("description"),
            tags=j.get("tags") or [], source_category=j.get("category") or "",
            job_type=(j.get("job_type") or "").replace("_", " "), force_remote=True))
    return out


def parse_remoteok(data):
    out = []
    for j in data or []:
        if not isinstance(j, dict) or "legal" in j or not j.get("position"):
            continue
        link = j.get("url") or ("https://remoteok.com/remote-jobs/" + str(j.get("slug", "")))
        out.append(make_job(
            j.get("position"), j.get("company"), link,
            "Remote OK", "https://remoteok.com",
            location=j.get("location") or "Worldwide",
            salary=fmt_salary(j.get("salary_min"), j.get("salary_max"), "USD", "year"),
            posted_at=j.get("date") or j.get("epoch"), description=j.get("description"),
            tags=j.get("tags") or [], force_remote=True))
    return out


def parse_arbeitnow(data):
    out = []
    for j in (data or {}).get("data", []):
        if not j.get("remote"):
            continue
        out.append(make_job(
            j.get("title"), j.get("company_name"), j.get("url"),
            "Arbeitnow", "https://www.arbeitnow.com",
            location=j.get("location") or "", posted_at=j.get("created_at"),
            description=j.get("description"), tags=j.get("tags") or [],
            job_type=", ".join(j.get("job_types") or []), force_remote=True))
    return out


def parse_jobicy(data):
    out = []
    for j in (data or {}).get("jobs", []):
        industry = j.get("jobIndustry") or []
        if isinstance(industry, str):
            industry = [industry]
        jtype = j.get("jobType") or []
        if isinstance(jtype, str):
            jtype = [jtype]
        geo = j.get("jobGeo") or "Anywhere"
        out.append(make_job(
            j.get("jobTitle"), j.get("companyName"), j.get("url"),
            "Jobicy", "https://jobicy.com", location=geo,
            salary=fmt_salary(j.get("annualSalaryMin") or j.get("salaryMin"),
                              j.get("annualSalaryMax") or j.get("salaryMax"),
                              j.get("salaryCurrency") or "USD", "year"),
            posted_at=j.get("pubDate"), description=j.get("jobExcerpt") or j.get("jobDescription"),
            tags=industry, source_category=" ".join(industry),
            job_type=", ".join(jtype), force_remote=True))
    return out


def parse_wwr(xml_bytes):
    out = []
    root = ET.fromstring(xml_bytes)
    for item in root.iter("item"):
        raw_title = (item.findtext("title") or "").strip()
        company, title = "", raw_title
        if ": " in raw_title:
            company, title = raw_title.split(": ", 1)
        out.append(make_job(
            title, company, (item.findtext("link") or "").strip(),
            "We Work Remotely", "https://weworkremotely.com",
            location=item.findtext("region") or "Worldwide",
            posted_at=item.findtext("pubDate"), description=item.findtext("description"),
            source_category=item.findtext("category") or "",
            job_type=item.findtext("type") or "", force_remote=True))
    return out


POPULAR_SOURCES = {
    "remotive": ("https://remotive.com/api/remote-jobs", "json", parse_remotive),
    "remoteok": ("https://remoteok.com/api", "json", parse_remoteok),
    "arbeitnow": ("https://www.arbeitnow.com/api/job-board-api", "json", parse_arbeitnow),
    "jobicy": ("https://jobicy.com/api/v2/remote-jobs?count=50", "json", parse_jobicy),
    "weworkremotely": ("https://weworkremotely.com/remote-jobs.rss", "xml", parse_wwr),
}


def fetch_popular(names):
    jobs = []
    for name in names:
        url, kind, parser = POPULAR_SOURCES[name]
        try:
            raw = http_get(url)
            parsed = parser(json.loads(raw.decode("utf-8", errors="replace")) if kind == "json" else raw)
            parsed = [j for j in parsed if j]
            log("  [ok]   {:<16} {} jobs".format(name, len(parsed)))
            jobs.extend(parsed)
        except (HTTPError, URLError, ET.ParseError, ValueError, OSError) as e:
            log("  [fail] {:<16} {}".format(name, e))
    return jobs


# --------------------------------------------------------------------------
# company sites
# --------------------------------------------------------------------------

def detect_site_type(url):
    p = urlparse(url)
    host = p.netloc.lower()
    parts = [x for x in p.path.split("/") if x]
    slug = parts[0] if parts else ""
    if "greenhouse.io" in host and slug:
        return "greenhouse", slug
    if host.endswith("lever.co") and slug:
        return "lever", slug
    if host.endswith("ashbyhq.com") and slug:
        return "ashby", slug
    if host.endswith("workable.com") and slug:
        return "workable", slug
    if re.search(r"\.(xml|rss)$", p.path) or "/feed" in p.path or "rss" in p.path.lower():
        return "rss", ""
    return "html", ""


def parse_greenhouse(data, site):
    out = []
    for j in (data or {}).get("jobs", []):
        loc = (j.get("location") or {}).get("name", "")
        if not (site["all_remote"] or is_remote_text(loc, j.get("title"))):
            continue
        out.append(make_job(
            j.get("title"), site["name"], j.get("absolute_url"), site["name"], site["url"],
            location=loc, posted_at=j.get("first_published") or j.get("updated_at"),
            description=j.get("content"), force_remote=site["all_remote"] or is_remote_text(loc)))
    return out


def parse_lever(data, site):
    out = []
    for j in data or []:
        cats = j.get("categories") or {}
        loc = cats.get("location") or ""
        remote = (j.get("workplaceType") == "remote") or is_remote_text(loc, j.get("text"))
        if not (site["all_remote"] or remote):
            continue
        sr = j.get("salaryRange") or {}
        out.append(make_job(
            j.get("text"), site["name"], j.get("hostedUrl") or j.get("applyUrl"),
            site["name"], site["url"], location=loc or ("Remote" if remote else ""),
            salary=fmt_salary(sr.get("min"), sr.get("max"), sr.get("currency", "USD"),
                              {"per-year-salary": "year", "per-hour-wage": "hour"}.get(sr.get("interval"), "")),
            posted_at=j.get("createdAt"), description=j.get("descriptionPlain") or j.get("description"),
            tags=[cats.get("team") or ""], job_type=cats.get("commitment") or "",
            force_remote=remote or site["all_remote"]))
    return out


def parse_ashby(data, site):
    out = []
    for j in (data or {}).get("jobs", []):
        if j.get("isListed") is False:
            continue
        loc = j.get("location") or ""
        remote = bool(j.get("isRemote")) or is_remote_text(loc, j.get("title"))
        if not (site["all_remote"] or remote):
            continue
        comp = j.get("compensation") or {}
        out.append(make_job(
            j.get("title"), site["name"], j.get("jobUrl") or j.get("applyUrl"),
            site["name"], site["url"], location=loc or ("Remote" if remote else ""),
            salary=comp.get("scrapeableCompensationSalarySummary") or comp.get("compensationTierSummary") or "",
            posted_at=j.get("publishedAt"), description=j.get("descriptionPlain") or j.get("descriptionHtml"),
            tags=[j.get("department") or "", j.get("team") or ""], job_type=j.get("employmentType") or "",
            force_remote=remote or site["all_remote"]))
    return out


def parse_workable(data, site):
    out = []
    for j in (data or {}).get("jobs", []):
        loc = ", ".join(x for x in [j.get("city"), j.get("state"), j.get("country")] if x)
        remote = bool(j.get("telecommuting")) or is_remote_text(loc, j.get("title"))
        if not (site["all_remote"] or remote):
            continue
        out.append(make_job(
            j.get("title"), site["name"], j.get("url") or j.get("shortlink") or j.get("application_url"),
            site["name"], site["url"], location=loc or ("Remote" if remote else ""),
            posted_at=j.get("published_on") or j.get("created_at"), description=j.get("description"),
            tags=[j.get("department") or ""], job_type=j.get("employment_type") or "",
            force_remote=remote or site["all_remote"]))
    return out


def parse_rss_site(xml_bytes, site):
    out = []
    root = ET.fromstring(xml_bytes)
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        desc = item.findtext("description") or ""
        if not (site["all_remote"] or is_remote_text(title, desc[:400])):
            continue
        out.append(make_job(
            title, site["name"], (item.findtext("link") or "").strip(), site["name"], site["url"],
            location="Remote", posted_at=item.findtext("pubDate"), description=desc,
            force_remote=True))
    return out


class _PageScanner(HTMLParser):
    """Collects JSON-LD blocks and anchor links from a careers page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.jsonld = []
        self.links = []
        self._in_ld = False
        self._ld_buf = []
        self._href = None
        self._a_buf = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self._in_ld, self._ld_buf = True, []
        elif tag == "a" and a.get("href"):
            self._href, self._a_buf = a["href"], []

    def handle_endtag(self, tag):
        if tag == "script" and self._in_ld:
            self._in_ld = False
            self.jsonld.append("".join(self._ld_buf))
        elif tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join("".join(self._a_buf).split())))
            self._href = None

    def handle_data(self, data):
        if self._in_ld:
            self._ld_buf.append(data)
        elif self._href is not None:
            self._a_buf.append(data)


def _walk_jobposting(node, found):
    if isinstance(node, list):
        for x in node:
            _walk_jobposting(x, found)
    elif isinstance(node, dict):
        t = node.get("@type")
        types = t if isinstance(t, list) else [t]
        if "JobPosting" in types:
            found.append(node)
        for v in node.values():
            if isinstance(v, (list, dict)):
                _walk_jobposting(v, found)


JOB_LINK_RE = re.compile(r"/(jobs?|careers?|positions?|openings?|vacanc\w+|apply|role|roles)/[^/?#]+", re.I)
GENERIC_LINK_TEXT = {"careers", "jobs", "view all jobs", "all jobs", "open positions", "apply now", "apply",
                     "learn more", "read more", "see all jobs", "view jobs", "join us", "view all", "back to jobs"}


def parse_html_site(page_html, site):
    scanner = _PageScanner()
    scanner.feed(page_html)
    out, seen = [], set()

    postings = []
    for block in scanner.jsonld:
        try:
            _walk_jobposting(json.loads(block), postings)
        except ValueError:
            continue
    for p in postings:
        org = p.get("hiringOrganization")
        company = (org.get("name") if isinstance(org, dict) else org) or site["name"]
        remote = str(p.get("jobLocationType", "")).upper() == "TELECOMMUTE" or is_remote_text(p.get("title"))
        if not (site["all_remote"] or remote):
            continue
        sal = ""
        bs = p.get("baseSalary")
        if isinstance(bs, dict):
            val = bs.get("value") if isinstance(bs.get("value"), dict) else {}
            sal = fmt_salary(val.get("minValue"), val.get("maxValue"), bs.get("currency", "USD"),
                             str(val.get("unitText", "")).lower())
        link = p.get("url") or site["url"]
        j = make_job(p.get("title"), company, urljoin(site["url"], link), site["name"], site["url"],
                     location="Remote" if remote else "", salary=sal, posted_at=p.get("datePosted"),
                     description=p.get("description"), force_remote=remote or site["all_remote"])
        if j and j["id"] not in seen:
            seen.add(j["id"])
            out.append(j)

    if out:
        return out

    # fallback: look for anchors that look like individual job links
    for href, text in scanner.links:
        full = urljoin(site["url"], href)
        if not JOB_LINK_RE.search(urlparse(full).path):
            continue
        if not (8 <= len(text) <= 140) or text.lower() in GENERIC_LINK_TEXT:
            continue
        if not (site["all_remote"] or is_remote_text(text)):
            continue
        j = make_job(text, site["name"], full, site["name"], site["url"],
                     location="Remote" if is_remote_text(text) else "", force_remote=site["all_remote"])
        if j and j["id"] not in seen:
            seen.add(j["id"])
            out.append(j)
    return out


def fetch_site(site):
    site = {"name": site.get("name") or urlparse(site["url"]).netloc,
            "url": site["url"], "type": site.get("type", "auto"),
            "all_remote": bool(site.get("all_remote")), "enabled": site.get("enabled", True)}
    site["name"] = re.sub(r"\s*\(example\)\s*$", "", site["name"], flags=re.I)
    kind, slug = (site["type"], "")
    if kind == "auto":
        kind, slug = detect_site_type(site["url"])
    elif kind in ("greenhouse", "lever", "ashby", "workable"):
        parts = [x for x in urlparse(site["url"]).path.split("/") if x]
        slug = parts[0] if parts else ""
    if kind == "greenhouse":
        return parse_greenhouse(http_json("https://boards-api.greenhouse.io/v1/boards/{}/jobs?content=true".format(slug)), site)
    if kind == "lever":
        return parse_lever(http_json("https://api.lever.co/v0/postings/{}?mode=json".format(slug)), site)
    if kind == "ashby":
        return parse_ashby(http_json("https://api.ashbyhq.com/posting-api/job-board/{}?includeCompensation=true".format(slug)), site)
    if kind == "workable":
        return parse_workable(http_json("https://apply.workable.com/api/v1/widget/accounts/{}?details=true".format(slug)), site)
    if kind == "rss":
        return parse_rss_site(http_get(site["url"]), site)
    return parse_html_site(http_get(site["url"], accept="text/html").decode("utf-8", errors="replace"), site)


def fetch_company_sites(sites):
    jobs = []
    for site in sites:
        if not site.get("url") or site.get("enabled") is False:
            continue
        label = site.get("name") or site["url"]
        try:
            found = [j for j in fetch_site(site) if j]
            log("  [ok]   {:<16} {} remote jobs".format(label[:16], len(found)))
            jobs.extend(found)
        except (HTTPError, URLError, ET.ParseError, ValueError, OSError, KeyError) as e:
            log("  [fail] {:<16} {}".format(label[:16], e))
    return jobs


# --------------------------------------------------------------------------
# storage / merge
# --------------------------------------------------------------------------

def read_json(name, default):
    path = DATA / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def write_json(name, obj):
    path = DATA / name
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def merge_into_pending(new_jobs, max_age_days):
    pending = read_json("pending.json", [])
    known = {j["id"] for j in pending}
    known |= {j["id"] for j in read_json("pool.json", [])}
    known |= {j["id"] for j in read_json("published.json", [])}
    known |= set(read_json("rejected.json", []))

    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    added, too_old, dupes = 0, 0, 0
    for j in new_jobs:
        if j["id"] in known:
            dupes += 1
            continue
        if j["posted_at"]:
            try:
                if datetime.fromisoformat(j["posted_at"]) < cutoff:
                    too_old += 1
                    continue
            except ValueError:
                pass
        known.add(j["id"])
        pending.append(j)
        added += 1

    # drop stale unreviewed jobs, newest first, cap the size
    stale_cutoff = datetime.now(timezone.utc) - timedelta(days=PENDING_MAX_AGE_DAYS)
    kept = []
    for j in pending:
        try:
            if datetime.fromisoformat(j.get("fetched_at", "")) < stale_cutoff:
                continue
        except ValueError:
            pass
        kept.append(j)
    kept.sort(key=lambda j: j.get("posted_at") or j.get("fetched_at") or "", reverse=True)
    write_json("pending.json", kept[:PENDING_MAX_ITEMS])
    return added, dupes, too_old, len(kept[:PENDING_MAX_ITEMS])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="comma-separated popular sources: " + ", ".join(POPULAR_SOURCES))
    ap.add_argument("--skip-sources", action="store_true", help="skip popular sources")
    ap.add_argument("--skip-sites", action="store_true", help="skip your company sites")
    ap.add_argument("--max-age-days", type=int, default=30, help="ignore jobs posted longer ago than this")
    args = ap.parse_args(argv)

    all_jobs = []
    if not args.skip_sources:
        names = [n.strip() for n in args.only.split(",")] if args.only else list(POPULAR_SOURCES)
        unknown = [n for n in names if n not in POPULAR_SOURCES]
        if unknown:
            log("Unknown source(s): {}".format(", ".join(unknown)))
            return 2
        log("Popular sources:")
        all_jobs += fetch_popular(names)
    if not args.skip_sites:
        sites = read_json("company_sites.json", [])
        log("Company sites ({}):".format(len([s for s in sites if s.get("enabled", True)])))
        all_jobs += fetch_company_sites(sites)

    added, dupes, too_old, total = merge_into_pending(all_jobs, args.max_age_days)
    log("")
    log("Fetched {} jobs: {} new, {} already known, {} too old.".format(len(all_jobs), added, dupes, too_old))
    log("Waiting for review: {}".format(total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
