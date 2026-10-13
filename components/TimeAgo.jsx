'use client';

import { useEffect, useState } from 'react';
import { formatDate, timeAgo } from '@/lib/utils';

// Renders a fixed date first (so the static HTML never goes stale),
// then switches to "3h ago" style text once it is in the browser.
export default function TimeAgo({ iso }) {
  const [label, setLabel] = useState(() => formatDate(iso));

  useEffect(() => {
    setLabel(timeAgo(iso));
  }, [iso]);

  if (!label) return null;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {label}
    </time>
  );
}
