import Link from 'next/link';
import AdSlot from '@/components/AdSlot';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { ArrowLeftIcon, BanknoteIcon, ClockIcon, ExternalLinkIcon } from '@/components/icons';
import { getCategories, getJob, getJobs } from '@/lib/data';
import { site } from '@/lib/site';
import { formatDate, hostOf, remoteLabel } from '@/lib/utils';

export const dynamicParams = false;

// One static page per live job. A placeholder keeps the build working while there are none yet.
export function generateStaticParams() {
  const jobs = getJobs();
  return jobs.length ? jobs.map((j) => ({ id: j.id })) : [{ id: 'no-jobs-yet' }];
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return { title: 'Job not found', robots: { index: false } };
  return {
    title: `${job.title} at ${job.company} (Remote)`,
    description: job.description || `${job.title} at ${job.company}. Remote job listed on ${site.name}.`,
    alternates: { canonical: `/jobs/${job.id}/` },
  };
}

function jobPostingJsonLd(job) {
  const posted = (job.posted_at || job.published_at || '').slice(0, 10);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || job.title,
    datePosted: posted || undefined,
    hiringOrganization: { '@type': 'Organization', name: job.company },
    jobLocationType: 'TELECOMMUTE',
    directApply: false,
    url: `${site.url}/jobs/${job.id}/`,
  };
  if (posted) {
    const until = new Date(posted + 'T00:00:00Z');
    until.setUTCDate(until.getUTCDate() + 45);
    ld.validThrough = until.toISOString();
  }
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

export default async function JobPage({ params }) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold">This job is no longer listed</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">It may have been filled or removed. Browse the latest remote jobs instead.</p>
        <Link href="/" className={buttonClasses({ className: 'mt-6' })}>
          See all jobs
        </Link>
      </div>
    );
  }

  const names = Object.fromEntries(getCategories().map((c) => [c.slug, c.name]));
  const related = getJobs()
    .filter((j) => j.id !== job.id && j.categories.some((c) => job.categories.includes(c)))
    .slice(0, 5);
  const sourceHost = hostOf(job.link);

  return (
    <article className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobPostingJsonLd(job) }} />

      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-indigo-600 dark:text-slate-400">
        <ArrowLeftIcon /> All jobs
      </Link>

      <Card className="mt-4">
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{job.title}</h1>
            <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">{job.company}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
            <Badge variant={job.remote_status === 'worldwide' ? 'success' : job.remote_status === 'restricted' ? 'warning' : 'default'}>
              {remoteLabel(job)}
            </Badge>
            {job.salary ? (
              <span className="inline-flex items-center gap-1.5">
                <BanknoteIcon /> {job.salary}
              </span>
            ) : null}
            {job.job_type ? <span>{job.job_type}</span> : null}
            {job.published_at || job.posted_at ? (
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon /> Listed {formatDate(job.published_at || job.posted_at)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {job.categories.map((slug) => (
              <Link key={slug} href={`/category/${slug}/`}>
                <Badge variant="outline" className="hover:border-indigo-400 hover:text-indigo-600">
                  {names[slug] || slug}
                </Badge>
              </Link>
            ))}
          </div>

          {job.description ? <p className="leading-relaxed text-slate-700 dark:text-slate-300">{job.description}</p> : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a href={job.link} target="_blank" rel="noopener" className={buttonClasses({ size: 'lg' })}>
              Apply{sourceHost ? ` on ${sourceHost}` : ''} <ExternalLinkIcon />
            </a>
            <span className="text-sm text-slate-500">
              Source:{' '}
              {job.source ? (
                <a href={job.source_url || job.link} target="_blank" rel="noopener" className="font-medium hover:underline">
                  {job.source}
                </a>
              ) : (
                sourceHost
              )}
            </span>
          </div>

          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/50">
            You apply directly with the employer or source site. Never pay to apply for a job or share bank details before you have verified the
            company.
          </p>
        </CardContent>
      </Card>

      <AdSlot slot="job" className="mt-6" />

      {related.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">More remote jobs like this</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/jobs/${r.id}/`} className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-slate-500"> · {r.company}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
