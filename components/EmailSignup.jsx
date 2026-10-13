import { site } from '@/lib/site';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Hidden until NEXT_PUBLIC_NEWSLETTER_ACTION is set (see lib/site.js).
export default function EmailSignup() {
  if (!site.newsletterAction) return null;
  return (
    <Card>
      <CardContent>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Get new remote jobs by email</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">A short daily digest. Unsubscribe any time.</p>
        <form action={site.newsletterAction} method="post" target="_blank" className="mt-3 flex flex-col gap-2">
          <Input type="email" name="email" required placeholder="you@example.com" aria-label="Email address" />
          <button
            type="submit"
            className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Subscribe
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
