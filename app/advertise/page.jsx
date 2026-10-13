import { buttonClasses } from '@/components/ui/button';
import { site } from '@/lib/site';

export const metadata = {
  title: 'Advertise',
  description: `Reach remote job seekers every day. Sponsor a placement or feature your job on ${site.name}.`,
  alternates: { canonical: '/advertise/' },
};

export default function AdvertisePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Advertise on {site.name}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Our visitors are people actively looking for remote work. Put your company, course or tool in front of them.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Ways to work with us</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700 dark:text-slate-300">
        <li>
          <strong>Featured job listing:</strong> your role is pinned and highlighted for visitors.
        </li>
        <li>
          <strong>Banner placement:</strong> a sponsored banner at the top of the job list, between listings or in the sidebar.
        </li>
        <li>
          <strong>Newsletter sponsorship:</strong> a mention in our daily jobs digest.
        </li>
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`mailto:${site.contactEmail}?subject=Advertising%20on%20${encodeURIComponent(site.name)}`} className={buttonClasses({ size: 'lg' })}>
          Email us for rates
        </a>
        {site.featuredListingUrl ? (
          <a href={site.featuredListingUrl} target="_blank" rel="noopener" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
            Post a featured job
          </a>
        ) : null}
      </div>
    </div>
  );
}
