import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">That page does not exist, or the job has been removed.</p>
      <Link href="/" className={buttonClasses({ className: 'mt-6' })}>
        Browse remote jobs
      </Link>
    </div>
  );
}
