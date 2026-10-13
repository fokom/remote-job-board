import JobBoard from '@/components/JobBoard';
import EmailSignup from '@/components/EmailSignup';
import { getCategoriesWithCounts, getJobs, toListItem } from '@/lib/data';
import { site } from '@/lib/site';

export const metadata = {
  title: { absolute: `${site.name}: ${site.tagline}` },
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const jobs = getJobs();
  const categories = getCategoriesWithCounts(jobs);

  return (
    <>
      <section className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Remote jobs, posted every day</h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Search hand-picked remote roles and gigs by category. Each listing links straight to the original employer or source.
        </p>
        {jobs.length > 0 ? (
          <p className="mt-2 text-sm text-slate-500">{jobs.length} live remote jobs</p>
        ) : null}
      </section>

      <JobBoard jobs={jobs.map(toListItem)} categories={categories} sidebar={<EmailSignup />} />
    </>
  );
}
