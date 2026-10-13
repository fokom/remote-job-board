import { site } from '@/lib/site';

export const metadata = {
  title: 'About',
  description: `${site.name} lists remote jobs and gigs every day and links to the original source of each one.`,
  alternates: { canonical: '/about/' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 leading-relaxed text-slate-700 dark:text-slate-300">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">About {site.name}</h1>
      <p>
        {site.name} is a free remote job board. Every day we collect remote roles and gigs from trusted job boards and company career pages,
        check them, tag them by category and publish them here.
      </p>
      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">How it works</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>We review each listing before it goes live and sort it into categories such as engineering, customer support and project management.</li>
        <li>Every job links back to the original posting, where you apply directly with the employer.</li>
        <li>The site is free for job seekers. It is supported by advertising and featured listings.</li>
      </ul>
      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">Stay safe</h2>
      <p>
        Legitimate employers never ask you to pay to apply. If something looks suspicious, tell us at{' '}
        <a className="text-indigo-600 hover:underline" href={`mailto:${site.contactEmail}`}>
          {site.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}
