import Link from 'next/link';
import JobBoard from '@/components/JobBoard';
import { getCategoriesWithCounts, getJobs, toListItem } from '@/lib/data';
import { site } from '@/lib/site';

export const dynamicParams = false;

export function generateStaticParams() {
  const categories = getCategoriesWithCounts();
  return (categories.length ? categories : [{ slug: 'other' }]).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = getCategoriesWithCounts().find((c) => c.slug === slug);
  if (!category) return { title: 'Category not found', robots: { index: false } };
  return {
    title: `Remote ${category.name} Jobs`,
    description: `Browse ${category.count} remote ${category.name.toLowerCase()} jobs on ${site.name}. Updated daily, each listing links to the original source.`,
    alternates: { canonical: `/category/${slug}/` },
    // Empty category pages are thin content, so keep them out of search results.
    robots: category.count === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const jobs = getJobs();
  const categories = getCategoriesWithCounts(jobs);
  const category = categories.find((c) => c.slug === slug);

  if (!category) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold">Category not found</h1>
        <Link href="/categories/" className="mt-4 inline-block text-indigo-600 hover:underline">
          See all categories
        </Link>
      </div>
    );
  }

  const inCategory = jobs.filter((j) => j.categories.includes(slug));

  return (
    <>
      <section className="mb-8">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:underline">Jobs</Link> / <Link href="/categories/" className="hover:underline">Categories</Link>
        </nav>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Remote {category.name} Jobs</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          {category.count} live {category.count === 1 ? 'job' : 'jobs'} in {category.name}. New roles are added daily.
        </p>
      </section>

      <JobBoard jobs={inCategory.map(toListItem)} categories={categories} fixedCategory={slug} />
    </>
  );
}
