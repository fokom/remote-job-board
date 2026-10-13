import Link from 'next/link';
import { site } from '@/lib/site';

const links = [
  { href: '/', label: 'Jobs' },
  { href: '/categories/', label: 'Categories' },
  { href: '/advertise/', label: 'Advertise' },
  { href: '/about/', label: 'About' },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {site.name}
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm font-medium">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
