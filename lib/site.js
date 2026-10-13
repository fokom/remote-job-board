// One place to rename and configure your site.
// Anything starting with process.env.NEXT_PUBLIC_ can be set in your host's
// environment-variable settings (or in a local .env.local file).

export const site = {
  name: 'RemoteNest', // placeholder: change to your brand
  tagline: 'Fresh remote jobs, every day',
  description:
    'Browse remote jobs posted daily across engineering, customer support, project management, design, gigs and more. Every listing links to the original employer or source.',
  // Your public address, with no trailing slash. Used for the sitemap and canonical links.
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@example.com',

  // Optional: a payment link (Stripe Payment Link, Lemon Squeezy, etc.) for featured listings.
  featuredListingUrl: process.env.NEXT_PUBLIC_FEATURED_LISTING_URL || '',

  // Optional: a form endpoint that accepts an "email" field (Buttondown, Formspree, ...).
  // The signup box stays hidden until this is set.
  newsletterAction: process.env.NEXT_PUBLIC_NEWSLETTER_ACTION || '',

  // Google AdSense. Leave the client empty until your account is approved.
  // Create ad units in AdSense and paste each unit's slot id below.
  adsense: {
    client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '', // e.g. ca-pub-1234567890123456
    slots: {
      top: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP || '',
      inline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE || '',
      sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || '',
      job: process.env.NEXT_PUBLIC_ADSENSE_SLOT_JOB || '',
    },
  },

  // Shown in ad slots whenever AdSense is not set up for that slot.
  // Use them for your own promotions, sponsors or affiliate links.
  houseAds: [
    {
      id: 'advertise',
      title: 'Reach remote job seekers every day',
      text: 'Promote your company, course or tool on this page.',
      cta: 'Advertise here',
      href: '/advertise/',
    },
  ],

  // Credited in the footer; keep these in line with the sources you enable in the fetcher.
  sources: [
    { name: 'Remotive', url: 'https://remotive.com' },
    { name: 'Remote OK', url: 'https://remoteok.com' },
    { name: 'We Work Remotely', url: 'https://weworkremotely.com' },
    { name: 'Arbeitnow', url: 'https://www.arbeitnow.com' },
    { name: 'Jobicy', url: 'https://jobicy.com' },
  ],
};
