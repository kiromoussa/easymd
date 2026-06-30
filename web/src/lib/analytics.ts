import posthog from 'posthog-js';

// Named events for easymd's core funnel. Keeping the union here means typos are a
// compile error and the event taxonomy lives in one place.
export type AnalyticsEvent =
  | 'document_opened'
  | 'document_created'
  | 'share_invite_sent'
  | 'invite_removed'
  | 'collaborator_role_changed'
  | 'link_access_changed'
  | 'version_restored'
  | 'cli_login';

// Safe wrapper: no-ops if PostHog was never initialized (e.g. key unset in local dev
// or CI), so call sites never need to null-check.
export function capture(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (posthog.__loaded) posthog.capture(event, properties);
}
