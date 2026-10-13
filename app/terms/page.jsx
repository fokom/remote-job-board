import { site } from '@/lib/site';

export const metadata = {
  title: 'Terms of Use',
  alternates: { canonical: '/terms/' },
};

// Starter template. Review and adapt before relying on it.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 leading-relaxed text-slate-700 dark:text-slate-300">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Terms of Use</h1>
      <p>By using {site.name} you agree to these terms.</p>

      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">Listings</h2>
      <p>
        Job listings come from third-party sources and employers. We do our best to review them, but we do not guarantee that a job is
        available, accurate or legitimate. Always verify an employer before sharing personal information, and never pay to apply for a job.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">No employment relationship</h2>
      <p>{site.name} is not an employer or recruiter. Applications are made directly with the employer or source site.</p>

      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">Liability</h2>
      <p>
        The site is provided as is. To the extent allowed by law, {site.name} is not liable for losses arising from your use of the site or
        from third-party websites you reach through it.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">Contact</h2>
      <p>
        <a className="text-indigo-600 hover:underline" href={`mailto:${site.contactEmail}`}>
          {site.contactEmail}
        </a>
      </p>
    </div>
  );
}
