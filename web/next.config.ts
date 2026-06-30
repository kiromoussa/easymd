import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  // Reverse-proxy PostHog through our own origin so analytics survives ad-blockers
  // (requests go to /ingest/* on this domain instead of *.posthog.com). Hosts are the
  // US region; change to eu(.i)?.posthog.com if the project moves regions.
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ];
  },
  // PostHog ingestion endpoints care about exact paths — don't append/strip the slash.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
