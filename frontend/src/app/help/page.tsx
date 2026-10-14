import { BookOpen, Bug, LifeBuoy, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Faq, type FaqItem } from "@/components/guide/faq";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { buttonClass, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "Answers to common questions about monitors, alerts, status pages and account security.",
};

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;
const ISSUES_URL = "https://github.com/tausif2907/uptime-monitor/issues";

const code = (s: string) => <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{s}</code>;

const items: FaqItem[] = [
  // --- Monitors -----------------------------------------------------------------------------
  {
    category: "Monitors",
    q: "My site shows DOWN but it works in my browser. Why?",
    keywords: "down works browser 403 429 blocked bot cloudflare redirect expected status",
    a: (
      <>
        <p>Open the monitor and look at <b>Recent failed checks</b> — the reason is written there. The usual causes:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Blocked as a bot (403 / 429):</b> some sites or firewalls block automated visitors. Whitelist our user agent {code("UptimeMonitor/1.0")}, or monitor a dedicated health URL.</li>
          <li><b>Different status code:</b> e.g. the page redirects with 301 or returns 204. Set <b>Expected status code</b> to that value.</li>
          <li><b>Timeout:</b> the site answered slower than your timeout. Raise it (e.g. to 15000 ms) or investigate why it&apos;s slow.</li>
          <li><b>Private address:</b> we can&apos;t check {code("localhost")} or internal IPs — the URL must be reachable from the internet.</li>
        </ul>
        <p>Use <b>Test URL</b> on the edit screen to try settings instantly.</p>
      </>
    ),
  },
  {
    category: "Monitors",
    q: "Which method should I pick: GET, HEAD or POST?",
    keywords: "method get head post",
    a: <p><b>GET</b> for almost everything — it loads the page like a browser. <b>HEAD</b> only fetches headers (lighter, but some servers reply 405). <b>POST</b> only for API endpoints that require it; we send an empty body.</p>,
  },
  {
    category: "Monitors",
    q: "How often are sites checked, and from where?",
    keywords: "interval frequency every minute region location",
    a: <p>Every 1, 2, 3 or 5 minutes — you choose per monitor. Checks run from our server; you can also click <b>Check now</b> on any monitor to check immediately.</p>,
  },
  {
    category: "Monitors",
    q: "Why can't I monitor localhost or 192.168.x.x?",
    keywords: "localhost private ip internal network ssrf blocked",
    a: <p>For security, our servers refuse to contact private or internal addresses (this stops people using us to probe networks — known as SSRF). Monitor a public URL instead; for internal services, expose a public health endpoint.</p>,
  },
  {
    category: "Monitors",
    q: "How do I stop checks during maintenance?",
    keywords: "pause maintenance stop resume",
    a: <p>Open the monitor and click <b>Pause</b>. Paused monitors aren&apos;t checked and never alert. Click <b>Resume</b> when you&apos;re done.</p>,
  },
  // --- Alerts -------------------------------------------------------------------------------
  {
    id: "alerts",
    category: "Alerts",
    q: "When exactly do I get an alert?",
    keywords: "alert email when incident two failures notification",
    a: (
      <p>
        After <b>2 failed checks in a row</b> an incident opens and every enabled channel gets <b>one</b> “down” alert.
        While it stays down we stay quiet. On the first successful check you get <b>one</b> “back up” alert with the outage
        duration. <Link href="/guide#alerts" className="text-brand-600 hover:underline">Try the simulator →</Link>
      </p>
    ),
  },
  {
    category: "Alerts",
    q: "I didn't receive an alert email",
    keywords: "no email not received spam alert missing",
    a: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Check your spam folder and mark our emails as “not spam”.</li>
        <li>Open the project&apos;s <b>Settings & alerts</b> and make sure your email channel is listed and enabled.</li>
        <li>Alerts only fire after 2 failures in a row — a single failed check doesn&apos;t alert.</li>
        <li>The monitor&apos;s <b>Incidents → Full history</b> page shows which alerts were sent and whether they failed.</li>
      </ul>
    ),
  },
  {
    category: "Alerts",
    q: "Can I get alerts in Slack or Discord?",
    keywords: "slack discord webhook teams",
    a: <p>Yes. Create an <b>incoming webhook</b> in Slack or Discord, then add it as a <b>Webhook</b> channel in your project&apos;s settings. We send a message both apps understand.</p>,
  },
  {
    id: "webhooks",
    category: "Alerts",
    q: "How do I verify that a webhook really came from Uptime Monitor?",
    keywords: "webhook signature hmac verify secret security",
    a: (
      <>
        <p>
          Each request has an {code("X-Uptime-Signature: t=<timestamp>,v1=<hmac>")} header. Compute HMAC-SHA256 of{" "}
          {code("<timestamp>.<raw body>")} with your channel&apos;s signing secret (in project settings), compare in constant time,
          and reject timestamps older than 5 minutes:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 text-xs text-zinc-100">{`import crypto from "node:crypto";

function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replay
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`}</pre>
      </>
    ),
  },
  // --- Status pages ---------------------------------------------------------------------------
  {
    category: "Status pages",
    q: "What does my public status page show?",
    keywords: "status page public share 90 days",
    a: <p>Your project name, each monitor&apos;s name and current status, 90 days of daily uptime bars, and incidents from the last 14 days. It never shows URLs, settings or your email.</p>,
  },
  {
    category: "Status pages",
    q: "How do I change my status page address?",
    keywords: "slug url change rename status page address",
    a: <p>Open the project → <b>Settings & alerts</b> → change <b>Status page address</b>. Note that the old link stops working.</p>,
  },
  // --- Account & security ----------------------------------------------------------------------
  {
    category: "Account & security",
    q: "How do I turn on two-factor authentication (2FA)?",
    keywords: "2fa two factor mfa authenticator totp security",
    a: <p>Go to <b>Account</b> → <b>Two-factor authentication</b> → scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), enter the 6-digit code, and <b>save your backup codes</b>.</p>,
  },
  {
    category: "Account & security",
    q: "I lost my phone with the authenticator app",
    keywords: "lost phone backup codes 2fa locked out recovery",
    a: <p>Sign in with your password and enter one of your <b>backup codes</b> instead of the 6-digit code. Then set up 2FA again on your new phone. No backup codes? Contact support from your account email.</p>,
  },
  {
    category: "Account & security",
    q: "I forgot my password",
    keywords: "forgot password reset",
    a: <p>Use <Link href="/forgot-password" className="text-brand-600 hover:underline">Forgot password</Link> on the sign-in page. We&apos;ll email a link that works once and expires in 30 minutes.</p>,
  },
  {
    category: "Account & security",
    q: "It says “Too many attempts”",
    keywords: "too many attempts rate limit locked",
    a: <p>To protect accounts from password guessing, we pause sign-in for an email address after 5 failed attempts in 15 minutes. Wait a little, or reset your password.</p>,
  },
  {
    category: "Account & security",
    q: "How do you keep my account and data safe?",
    keywords: "security privacy safe data encryption",
    a: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Passwords are hashed with bcrypt; 2FA secrets are encrypted; reset links are single-use and stored only as hashes.</li>
        <li>Sign-in is rate limited and sessions use secure, HTTP-only cookies.</li>
        <li>Strict security headers (CSP, no framing), and every request is checked so you can only see your own projects.</li>
        <li>Webhooks are signed, and our checker can&apos;t be pointed at private networks.</li>
      </ul>
    ),
  },
];

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="animate-slide-up text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/10">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">How can we help?</h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            New here? Start with the <Link href="/guide" className="font-medium text-brand-600 hover:underline">3-minute guide</Link>.
          </p>
        </div>

        <div className="mt-10">
          <Faq items={items} />
        </div>

        <Card className="mt-12 p-6">
          <h2 className="text-lg font-semibold">Still stuck? Get in touch</h2>
          <p className="mt-1 text-sm text-zinc-500">Tell us the monitor name, what you expected, and what you see.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {SUPPORT_EMAIL && (
              <a href={`mailto:${SUPPORT_EMAIL}`} className={buttonClass("primary")}>
                <Mail className="h-4 w-4" /> Email support
              </a>
            )}
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
              <Bug className="h-4 w-4" /> Report a bug
            </a>
            <Link href="/guide" className={buttonClass("ghost")}>
              <BookOpen className="h-4 w-4" /> Read the guide
            </Link>
          </div>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
