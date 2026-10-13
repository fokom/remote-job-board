import { site } from '@/lib/site';

export const metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: '/privacy/' },
};

// Starter template. Review it, adapt it to how you actually run the site
// (analytics, newsletter provider, local laws) and have it checked if you can.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 leading-relaxed text-slate-700 dark:text-slate-300">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Privacy Policy</h1>
      <p>This policy explains what information {site.name} collects and how it is used.</p>

      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">Information we collect</h2>
      <p>
        We do not require you to create an account to browse jobs. Our hosting provider may keep standard server logs (such as IP address and
        browser type) for security and performance. If you subscribe to our newsletter, we receive the email address you provide.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">Advertising and cookies</h2>
      <p>
        We show ads, including ads served by third parties such as Google. These companies may use cookies to show ads based on your visits to
        this and other websites. You can manage personalised advertising in your Google Ads Settings, or through your browser's cookie settings.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">Links to other sites</h2>
      <p>
        Job listings link to employers and job boards we do not control. Their privacy practices apply once you leave {site.name}.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-slate-900 dark:text-white">Contact</h2>
      <p>
        Questions about this policy? Email{' '}
        <a className="text-indigo-600 hover:underline" href={`mailto:${site.contactEmail}`}>
          {site.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}
