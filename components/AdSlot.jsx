'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { site } from '@/lib/site';
import { cn } from '@/lib/utils';

// Shows a Google AdSense unit when AdSense is configured for this slot,
// otherwise one of your own "house ads" from lib/site.js.
// Slots: "top" | "inline" | "sidebar" | "job"

function pick(slot, list) {
  let hash = 0;
  for (const ch of slot) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return list[hash % list.length];
}

export default function AdSlot({ slot = 'inline', className = '' }) {
  const client = site.adsense.client;
  const slotId = site.adsense.slots[slot];
  const useAdsense = Boolean(client && slotId);

  useEffect(() => {
    if (!useAdsense) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ad blockers and slow scripts can throw here; nothing to do
    }
  }, [useAdsense]);

  if (useAdsense) {
    return (
      <div className={cn('min-h-[100px] overflow-hidden', className)} aria-label="Advertisement">
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={client}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  if (!site.houseAds.length) return null;
  const ad = pick(slot, site.houseAds);
  const external = /^https?:\/\//i.test(ad.href);

  return (
    <aside
      aria-label="Advertisement"
      className={cn(
        'relative flex min-h-[100px] flex-col justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 ' +
          'dark:border-slate-700 dark:bg-slate-900',
        className
      )}
    >
      <span className="absolute right-3 top-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ad</span>
      <p className="font-semibold text-slate-900 dark:text-slate-100">{ad.title}</p>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{ad.text}</p>
      {external ? (
        <a
          href={ad.href}
          target="_blank"
          rel="sponsored noopener"
          className="mt-2 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {ad.cta} →
        </a>
      ) : (
        <Link href={ad.href} className="mt-2 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          {ad.cta} →
        </Link>
      )}
    </aside>
  );
}
