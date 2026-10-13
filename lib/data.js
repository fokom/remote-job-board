// Reads the JSON files in /data at build time (server only).
// The admin UI writes these files; the site only ever shows data/published.json.
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
  } catch {
    return fallback;
  }
}

export function getCategories() {
  return readJson('categories.json', []);
}

const sortNewest = (a, b) =>
  String(b.published_at || b.posted_at || '').localeCompare(String(a.published_at || a.posted_at || ''));

// All live jobs, newest first. Jobs without a valid category are skipped.
export function getJobs() {
  const known = new Set(getCategories().map((c) => c.slug));
  return readJson('published.json', [])
    .filter((j) => j && j.id && j.title && /^https?:\/\//i.test(j.link || ''))
    .map((j) => ({ ...j, categories: (j.categories || []).filter((s) => known.has(s)) }))
    .filter((j) => j.categories.length > 0)
    .sort(sortNewest);
}

export function getJob(id) {
  return getJobs().find((j) => j.id === id) || null;
}

// Categories with how many live jobs each one has.
export function getCategoriesWithCounts(jobs = getJobs()) {
  return getCategories().map((c) => ({
    ...c,
    count: jobs.filter((j) => j.categories.includes(c.slug)).length,
  }));
}

// The smaller object sent to the browser for the searchable list.
export function toListItem(job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    link: job.link,
    salary: job.salary || '',
    remote_status: job.remote_status || 'unclear',
    location: job.location || '',
    job_type: job.job_type || '',
    source: job.source || '',
    date: job.published_at || job.posted_at || '',
    categories: job.categories,
  };
}
