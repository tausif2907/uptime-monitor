import {
  ArrowRight,
  Bell,
  CheckCircle2,
  FolderPlus,
  Globe,
  LineChart,
  PlusCircle,
  Settings2,
  Share2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IncidentSimulator } from "@/components/guide/incident-simulator";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonClass, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "How it works — a 3-minute guide",
  description: "Learn how Uptime Monitor checks your websites, when it alerts you, and how to share a status page.",
};

const toc = [
  ["what", "What it does"],
  ["start", "Get started in 5 steps"],
  ["statuses", "What the statuses mean"],
  ["alerts", "When you get alerts (try it!)"],
  ["settings", "Choosing monitor settings"],
  ["status-page", "Your public status page"],
  ["next", "Who it helps"],
];

const steps = [
  { icon: FolderPlus, title: "Create an account and a project", body: "Sign up with Google, GitHub or email. Then create a project — a folder for related websites (e.g. “My portfolio” or “Client: Acme”)." },
  { icon: PlusCircle, title: "Add a monitor", body: "Click “Add monitor”, paste the website address and press “Test URL” to see what our servers see. Keep the default settings if unsure." },
  { icon: LineChart, title: "Watch the first check", body: "Within a minute the status turns from Pending to Up, and you start seeing response times and a chart." },
  { icon: Bell, title: "Turn on alerts", body: "In the project's “Settings & alerts”, make sure your email is listed. Add a Slack or Discord webhook if your team lives there." },
  { icon: Share2, title: "Share your status page", body: "Copy the /status/your-project link and put it in your website footer, README or support replies." },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="max-w-3xl animate-slide-up">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Guide</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">How Uptime Monitor works</h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            A 3-minute tour: what we check, when we alert you, and how to get the most out of it.
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[14rem_1fr]">
          <nav className="hidden lg:block">
            <div className="sticky top-24 space-y-1 text-sm">
              <p className="mb-2 font-semibold">On this page</p>
              {toc.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">
                  {label}
                </a>
              ))}
            </div>
          </nav>

          <div className="max-w-3xl space-y-16">
            <Section id="what" title="What it does">
              <p>
                Every website goes down sometimes — a server crashes, hosting expires, an update breaks something. Usually
                the owner finds out late, from an annoyed customer. <b>Uptime Monitor is a smoke alarm for your website.</b>
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["1. We visit", "Our servers open your URL every 1–5 minutes, like a visitor would."],
                  ["2. We judge", "We check the response code and how long it took."],
                  ["3. We tell you", "If it's broken twice in a row, you get an email. And again when it's fixed."],
                ].map(([t, b]) => (
                  <Card key={t} className="p-4">
                    <p className="font-semibold">{t}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{b}</p>
                  </Card>
                ))}
              </div>
            </Section>

            <Section id="start" title="Get started in 5 steps">
              <ol className="space-y-3">
                {steps.map(({ icon: Icon, title, body }, i) => (
                  <li key={title} className="flex gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold">{i + 1}. {title}</p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href="/signup" className={buttonClass("primary")}>
                Create your free account <ArrowRight className="h-4 w-4" />
              </Link>
            </Section>

            <Section id="statuses" title="What the statuses mean">
              <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                {[
                  [<StatusBadge key="p" status="PENDING" />, "Just added — waiting for the first check (usually under a minute)."],
                  [<StatusBadge key="u" status="UP" />, "The last check succeeded: the site answered with the expected status code in time."],
                  [<StatusBadge key="d" status="DOWN" />, "Two or more checks in a row failed. An incident is open and you've been alerted."],
                  [<StatusBadge key="pa" status="UP" paused />, "You paused monitoring (e.g. during planned maintenance). No checks, no alerts."],
                ].map(([badge, text], i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-zinc-200 px-4 py-3 last:border-0 dark:border-zinc-800">
                    <div className="w-24 shrink-0">{badge}</div>
                    <p className="text-sm">{text}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                On each monitor you&apos;ll also see <b>heartbeat bars</b> (the last 30 checks: green = OK, red = failed),
                a <b>response-time chart</b> and <b>uptime %</b> for the last 24 hours, 7 days and 30 days.
              </p>
            </Section>

            <Section id="alerts" title="When you get alerts (try it!)">
              <p>
                One failed check isn&apos;t an outage — networks hiccup. So we only open an <b>incident</b> after{" "}
                <b>2 failed checks in a row</b>, send <b>one</b> “down” alert, stay quiet while it&apos;s down, and send{" "}
                <b>one</b> “back up” alert on the first successful check. This simulator runs the exact same logic as our servers:
              </p>
              <IncidentSimulator />
              <p className="text-sm text-zinc-500">
                With 1-minute checks, you typically hear about an outage within about 2 minutes.
              </p>
            </Section>

            <Section id="settings" title="Choosing monitor settings">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["URL", "Use your homepage, or a dedicated health page like /health or /api/status for APIs."],
                  ["Method", "GET (default) loads the page like a browser — right for almost everything. HEAD fetches only headers. POST only for APIs that require it."],
                  ["Check every", "1 minute finds problems fastest. 5 minutes is fine for hobby sites."],
                  ["Timeout", "If no answer arrives within this time, the check fails. 10 seconds is a good default."],
                  ["Expected status code", "200 means “OK”. If a site deliberately redirects (301/302), put that code here."],
                  ["Test URL button", "Runs a real check before you save, so you can fix settings straight away."],
                ].map(([t, b]) => (
                  <Card key={t} className="p-4">
                    <p className="flex items-center gap-2 font-semibold"><Settings2 className="h-4 w-4 text-brand-600" /> {t}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{b}</p>
                  </Card>
                ))}
              </div>
            </Section>

            <Section id="status-page" title="Your public status page">
              <p>
                Every project gets a public page at <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-800">/status/your-project</code>{" "}
                showing current status, 90 days of daily uptime bars and recent incidents. It never shows your URLs or settings.
                Link to it from your footer so customers can check before contacting support.
              </p>
              <Link href="/status/demo" className={buttonClass("secondary")}>
                <Globe className="h-4 w-4" /> See the demo status page
              </Link>
            </Section>

            <Section id="next" title="Who it helps">
              <ul className="space-y-2">
                {[
                  "Small businesses whose website takes orders or bookings — every hour down is lost money.",
                  "Freelancers and agencies looking after client websites — know before the client calls.",
                  "Developers with APIs, portfolios and side projects.",
                  "Teams who want customers to check a status page instead of flooding support.",
                ].map((t) => (
                  <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> {t}</li>
                ))}
              </ul>
              <p>
                Stuck? Visit <Link href="/help" className="font-medium text-brand-600 hover:underline">Help & FAQ</Link> for troubleshooting and support.
              </p>
            </Section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
