import Link from 'next/link';
import { site } from '@/lib/site';

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap justify-between gap-6">
          <div className="max-w-md">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{site.name}</p>
            <p className="mt-1">{site.tagline}. Every listing links to the original employer or source.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/categories/" className="hover:underline">Categories</Link>
            <Link href="/advertise/" className="hover:underline">Advertise</Link>
            <Link href="/about/" className="hover:underline">About</Link>
            <Link href="/privacy/" className="hover:underline">Privacy</Link>
            <Link href="/terms/" className="hover:underline">Terms</Link>
          </nav>
        </div>

        <p className="mt-6">
          Listings include jobs from{' '}
          {site.sources.map((s, i) => (
            <span key={s.name}>
              <a href={s.url} target="_blank" rel="noopener" className="font-medium hover:underline">
                {s.name}
              </a>
              {i < site.sources.length - 1 ? ', ' : '.'}
            </span>
          ))}{' '}
          We always link back to the original posting.
        </p>
        <p className="mt-2 text-slate-500">© {new Date().getFullYear()} {site.name}</p>
      </div>
    </footer>
  );
}
