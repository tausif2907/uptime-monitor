/**
 * The demo account is shared by everyone who clicks "Try the demo". To stop it being abused:
 *  - it can't add alert channels (no sending emails/webhooks to strangers via our servers)
 *  - the seeded "demo" project (public at /status/demo) is read-only
 *  - status pages of other demo-created projects are not public
 *  - the worker deletes demo-created projects nightly
 */
export const DEMO_PROJECT_SLUG = "demo";

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email === (process.env.DEMO_EMAIL ?? "demo@uptime.local").toLowerCase();
}

export const DEMO_READ_ONLY_MESSAGE =
  "The sample Demo Project is read-only so it stays tidy for everyone. Create your own project to try editing — or sign up for free.";

export const DEMO_NO_ALERTS_MESSAGE =
  "Alerts are switched off on the shared demo account. Create a free account to get email and webhook alerts.";

export function isReadOnlyForDemo(user: { email: string }, project: { slug: string }): boolean {
  return isDemoEmail(user.email) && project.slug === DEMO_PROJECT_SLUG;
}
