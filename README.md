# Remote Job Board (starter)

A free remote job board you can run today:

1. **Fetcher** (Python, no packages needed) pulls remote jobs from popular sources and from your own list of company career pages.
2. **Admin** (local, no packages needed) shows what was fetched. You click each link to verify it, tag categories, add the good ones to your pool, and publish.
3. **Public site** (Next.js + Tailwind, exported as plain static files) lets anyone search by category, see ads and click through to apply. Host it free.

```
data/        categories, company_sites, pending → pool → published (+ rejected ids)
fetcher/     fetch_jobs.py and offline tests
admin/       local review UI (node admin/server.js)
app/ components/ lib/   the public Next.js site
```

## Requirements

- Node.js 20+ and Python 3.8+
- Git and a free GitHub account (for deploying)

## 1. First run

```bash
npm install
npm run admin          # starts the admin; open http://localhost:4321
```

The admin works without `npm install` (it has no dependencies); `npm install` is only needed for the public site.

On Windows, if `python3` is not found, the admin falls back to `python` / `py` automatically. For the command line, use `python fetcher/fetch_jobs.py`.

## 2. Your daily routine (about 10 minutes)

1. Open the admin and click **Fetch new jobs**. New listings land in **Review**.
2. For each job: click the title to open the original page and verify it. Check the suggested category tags (click to change), then **Add to pool**. Use **Reject** for junk; rejected jobs never come back.
   - Bulk tools: *Select shown*, *Tag selected as…*, *Add selected to pool*.
3. Open **Pool** and click **Publish** (or *Publish all*). You can fix title, company, salary and remote status with **Edit details**.
4. Click **Deploy to site**. It commits the `data` folder and pushes; your host rebuilds and the jobs go live.

Jobs you never publish simply expire from Review after 21 days.

### Adding your own company sites

Admin → **Sources** → *Add site*. Paste a careers page or job board URL.

| Type | Works with | Notes |
|---|---|---|
| `auto` | detects the rest from the URL | use this first |
| `greenhouse`, `lever`, `ashby`, `workable` | `boards.greenhouse.io/<co>`, `jobs.lever.co/<co>`, `jobs.ashbyhq.com/<co>`, `apply.workable.com/<co>` | most reliable |
| `rss` | any job RSS/Atom-style feed | |
| `html` | ordinary careers pages | reads `JobPosting` markup, else job-looking links; less reliable |

Tick **All jobs remote** for fully remote companies. Otherwise only jobs that mention "remote" are kept.
The two example sites shipped in `data/company_sites.json` are placeholders; change or remove them.

## 3a. Test it on GitHub Pages (no domain needed)

Your test address will be `https://<your-username>.github.io/<repo-name>/`.

1. Create a **public** GitHub repo (free accounts need a public repo for Pages) and push this folder to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow `.github/workflows/deploy-pages.yml` runs on every push to `main`, builds the site and publishes it. Watch it in the **Actions** tab; the first run takes a couple of minutes.
4. After that, the admin's **Deploy to site** button (commit + push) updates the live test site.

Notes: the workflow sets the sub-path and site address for you, so no settings are needed. Google AdSense will not approve a `github.io` address, so ads will show your own "Advertise here" placeholder until you have a domain. Because the repo is public, so are your `data/` files (that is only job listings you chose to publish, plus your list of company sites).

## 3b. Deploy with a custom domain or another host

1. Create a GitHub repo and push this folder (`git init`, `git add .`, `git commit`, `git remote add origin …`, `git push -u origin main`).
2. Create a project on **Cloudflare Pages** (or Netlify / Vercel) from that repo:
   - Build command: `npm run build`
   - Output directory: `out`
   - Environment variables: `NODE_VERSION=22` and `NEXT_PUBLIC_SITE_URL=https://your-domain` (see `.env.example`)
3. From now on, **Deploy to site** in the admin (or any `git push`) rebuilds the site.

Preview locally with `npm run dev` (http://localhost:3000).

## 4. Branding, ads and money

Everything lives in **`lib/site.js`**:

- `name`, `tagline`, `contactEmail`: rename the site (the name `RemoteNest` is a placeholder).
- **House ads**: shown in every ad slot until AdSense is set up. Use them for sponsors or affiliate links (`houseAds`).
- **Google AdSense**: after approval set `NEXT_PUBLIC_ADSENSE_CLIENT` and the four slot ids (`top`, `inline`, `sidebar`, `job`) in your host's environment variables. Slots without an id keep showing house ads. Put the line AdSense gives you into `public/ads.txt`. AdSense generally wants your own domain, a privacy policy (included as a starter) and real content, so apply once the site has some traffic.
- **Featured listings**: set `NEXT_PUBLIC_FEATURED_LISTING_URL` to a Stripe/Lemon Squeezy payment link and a button appears on the Advertise page.
- **Email list**: set `NEXT_PUBLIC_NEWSLETTER_ACTION` to a form endpoint (Buttondown, Formspree…) and the signup box appears.

The Privacy and Terms pages are starter templates. Read and adapt them to how you actually run the site.

## Good to know

- **Links back**: each job links to its original page and credits its source (required by several of the sources' terms). Keep the footer credits and the "Source:" link. Check each source's current terms before heavy use, and keep fetching to a few runs a day.
- **Snippets only**: the fetcher stores a ~280-character excerpt, not the full description. Visitors apply on the source site. That keeps you on the right side of source terms, but it also means Google for Jobs may not accept these pages; the `JobPosting` markup is best-effort.
- **Static site limits**: the whole job list is built into the page, which is fine for hundreds to a few thousand jobs. When you outgrow it, move the list behind an API (Node + a database such as Supabase) and keep the same front end.
- **Optional daily auto-fetch**: `.github/workflows/fetch-jobs.yml` can run the fetcher on GitHub and commit `data/pending.json`. It is manual-only by default. If you enable the schedule, run `git pull` before using the admin to avoid merge conflicts.
- **Tests**: `npm run test:fetcher` runs the offline parser tests.
- The admin only listens on `127.0.0.1` and rejects requests from other sites. Do not expose it to the internet.

## Ideas for next steps

Guides and an AI resume helper for traffic, saved searches, employer accounts and paid posting with a Node backend, a daily email digest from the published list.
