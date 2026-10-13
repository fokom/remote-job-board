import Link from 'next/link';
import AdSlot from '@/components/AdSlot';
import { Card, CardContent } from '@/components/ui/card';
import { getCategoriesWithCounts } from '@/lib/data';

export const metadata = {
  title: 'Remote Job Categories',
  description: 'Browse remote jobs by category: engineering, customer support, project management, design, gigs and more.',
  alternates: { canonical: '/categories/' },
};

export default function CategoriesPage() {
  const categories = getCategoriesWithCounts();

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Remote jobs by category</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Pick a category to see the latest remote jobs.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link key={c.slug} href={`/category/${c.slug}/`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {c.count}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <AdSlot slot="inline" className="mt-8" />
    </>
  );
}
