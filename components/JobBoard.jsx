'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import JobCard from '@/components/JobCard';
import AdSlot from '@/components/AdSlot';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const AD_EVERY = 6; // an inline ad after every N job cards

// The searchable job list.
//   jobs        : list items from lib/data.js toListItem()
//   categories  : [{ slug, name, count }]
//   fixedCategory : when set (category pages), the list is locked to that category
//   sidebar     : optional extra content for the right-hand column
export default function JobBoard({ jobs, categories, fixedCategory = null, sidebar = null }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(fixedCategory || '');
  const [worldwideOnly, setWorldwideOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.slug, c.name])), [categories]);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return jobs.filter((job) => {
      if (category && !job.categories.includes(category)) return false;
      if (worldwideOnly && job.remote_status !== 'worldwide') return false;
      if (!words.length) return true;
      const haystack = [job.title, job.company, job.location, job.salary, ...job.categories.map((s) => categoryNames[s] || s)]
        .join(' ')
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [jobs, query, category, worldwideOnly, categoryNames]);

  const shown = filtered.slice(0, visible);
  const resetPaging = () => setVisible(PAGE_SIZE);
  const chips = categories.filter((c) => c.count > 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <Card>
          <CardContent className="space-y-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPaging();
                }}
                placeholder="Search by title, company or keyword"
                aria-label="Search jobs"
                className="pl-9"
              />
            </div>

            {!fixedCategory && chips.length > 0 ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                <Chip
                  active={category === ''}
                  onClick={() => {
                    setCategory('');
                    resetPaging();
                  }}
                >
                  All
                </Chip>
                {chips.map((c) => (
                  <Chip
                    key={c.slug}
                    active={category === c.slug}
                    onClick={() => {
                      setCategory(category === c.slug ? '' : c.slug);
                      resetPaging();
                    }}
                  >
                    {c.name} <span className="opacity-60">{c.count}</span>
                  </Chip>
                ))}
              </div>
            ) : null}

            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={worldwideOnly}
                onChange={(e) => {
                  setWorldwideOnly(e.target.checked);
                  resetPaging();
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              Open to candidates worldwide
            </label>
          </CardContent>
        </Card>

        <AdSlot slot="top" className="mt-4" />

        <p className="mt-5 text-sm text-slate-500" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
        </p>

        <div className="mt-3 space-y-3">
          {shown.map((job, i) => (
            <Fragment key={job.id}>
              <JobCard job={job} categoryNames={categoryNames} />
              {(i + 1) % AD_EVERY === 0 && i + 1 < shown.length ? <AdSlot slot="inline" /> : null}
            </Fragment>
          ))}

          {jobs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-slate-600 dark:text-slate-400">
                No jobs have been published yet. Check back soon.
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-slate-600 dark:text-slate-400">
                No jobs match your search. Try a different keyword or category.
              </CardContent>
            </Card>
          ) : null}
        </div>

        {filtered.length > shown.length ? (
          <div className="mt-6 text-center">
            <Button variant="outline" size="lg" onClick={() => setVisible(visible + PAGE_SIZE)}>
              Show more jobs ({filtered.length - shown.length} left)
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <AdSlot slot="sidebar" />
        <Card>
          <CardContent>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Browse by category</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {categories
                .filter((c) => c.count > 0)
                .map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/category/${c.slug}/`}
                      className="flex justify-between rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <span>{c.name}</span>
                      <span className="text-slate-400">{c.count}</span>
                    </Link>
                  </li>
                ))}
              {categories.every((c) => c.count === 0) ? <li className="text-slate-500">Categories appear once jobs are live.</li> : null}
            </ul>
          </CardContent>
        </Card>
        {sidebar}
      </aside>
    </div>
  );
}

function Chip({ active, className, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
        className
      )}
      {...props}
    />
  );
}
