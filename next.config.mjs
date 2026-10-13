// GitHub Pages serves a project site from a sub-path (https://user.github.io/repo-name/).
// The deploy workflow sets NEXT_PUBLIC_BASE_PATH for you; leave it empty for a custom domain,
// Cloudflare Pages, Netlify, Vercel, or local development.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build a fully static site (plain HTML/CSS/JS in the "out" folder) so it can be hosted for free.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
