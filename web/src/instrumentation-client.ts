// Client-side analytics bootstrap. Next runs this file after the HTML loads but
// before React hydration (see node_modules/next/dist/docs — instrumentation-client),
// which is the ideal point to stand up PostHog so early pageviews are captured.
import posthog from 'posthog-js';

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    // Same-origin reverse proxy (see next.config.ts rewrites) so ad-blockers don't
    // drop events. ui_host keeps "view in PostHog" deep-links pointing at the real app.
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
    ui_host: 'https://us.posthog.com',
    // Modern default bundle: autocapture + pageview + pageleave, and crucially
    // history-API pageviews — so client-side App Router navigations are tracked
    // without a manual route listener.
    defaults: '2025-05-24',
    // Don't create profiles for anonymous visitors; we identify real users on
    // sign-in (see posthog-identify.tsx). Keeps the free-tier event count honest.
    person_profiles: 'identified_only',
  });
}
