import { getCategoriesWithCounts, getJobs } from '@/lib/data';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap() {
  const now = new Date();
  const jobs = getJobs();
  const categories = getCategoriesWithCounts(jobs).filter((c) => c.count > 0);

  const fixed = ['/', '/categories/', '/advertise/', '/about/', '/privacy/', '/terms/'].map((path) => ({
    url: `${site.url}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : 0.5,
  }));

  const categoryPages = categories.map((c) => ({
    url: `${site.url}/category/${c.slug}/`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const jobPages = jobs.map((j) => ({
    url: `${site.url}/jobs/${j.id}/`,
    lastModified: new Date(j.published_at || j.posted_at || now),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...fixed, ...categoryPages, ...jobPages];
}
