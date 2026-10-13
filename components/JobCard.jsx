import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { BanknoteIcon, ClockIcon, ExternalLinkIcon, MapPinIcon } from '@/components/icons';
import TimeAgo from '@/components/TimeAgo';
import { remoteLabel } from '@/lib/utils';

export default function JobCard({ job, categoryNames = {} }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">
            <Link href={`/jobs/${job.id}/`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {job.company}
            {job.source ? <span className="text-slate-400"> · via {job.source}</span> : null}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
            <Badge variant={job.remote_status === 'worldwide' ? 'success' : job.remote_status === 'restricted' ? 'warning' : 'default'}>
              {remoteLabel(job)}
            </Badge>
            {job.salary ? (
              <span className="inline-flex items-center gap-1.5">
                <BanknoteIcon /> {job.salary}
              </span>
            ) : null}
            {job.location && job.remote_status === 'unclear' ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon /> {job.location}
              </span>
            ) : null}
            {job.date ? (
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon /> <TimeAgo iso={job.date} />
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.categories.map((slug) => (
              <Link key={slug} href={`/category/${slug}/`}>
                <Badge variant="outline" className="hover:border-indigo-400 hover:text-indigo-600">
                  {categoryNames[slug] || slug}
                </Badge>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 sm:flex-col">
          <a href={job.link} target="_blank" rel="noopener" className={buttonClasses({ size: 'md' })}>
            Apply <ExternalLinkIcon />
          </a>
          <Link href={`/jobs/${job.id}/`} className={buttonClasses({ variant: 'outline', size: 'md' })}>
            Details
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
