import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  // PostHog reverse proxy (see next.config.ts rewrites). Must be public or Clerk
  // redirects analytics requests — including anonymous landing-page pageviews — to sign-in.
  '/ingest(.*)',
  // CLI endpoints authenticate with their own Bearer token (verified in the route),
  // not a Clerk session cookie — so they must be exempt from Clerk's cookie protection.
  '/api/cli/documents',
  '/api/cli/revoke',
  '/api/cli/settings',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
