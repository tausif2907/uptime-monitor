import {
  ArrowRight,
  BellRing,
  Clock,
  Globe,
  LineChart,
  ShieldCheck,
  Siren,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { buttonClass, Card } from "@/components/ui";

const steps = [
  { n: 1, title: "Add your website", body: "Paste a URL. We check it from our servers every 1–5 minutes, just like a visitor would." },
  { n: 2, title: "Get alerted instantly", body: "If it fails twice in a row we email you. When it's back, we email you again." },
  { n: 3, title: "Share your status", body: "Give customers a public status page with 90 days of uptime history." },
];

const features = [
  { icon: Clock, title: "Checks every minute", body: "Strict timeouts and a dedicated worker, so slow sites never slow you down." },
  { icon: Siren, title: "No false alarms", body: "An incident opens only after 2 failures in a row — one blip isn't an outage." },
  { icon: BellRing, title: "Email & webhook alerts", body: "One alert when it breaks, one when it recovers. Never duplicates. Slack & Discord via webhooks." },
  { icon: Globe, title: "Public status pages", body: "A clean, shareable page per project: current status, 90-day bars and past incidents." },
  { icon: LineChart, title: "Response-time charts", body: "See how fast your site answers and spot slowdowns before they become outages." },
  { icon: ShieldCheck, title: "Secure by design", body: "Two-factor sign-in, SSRF protection, rate limiting and signed webhooks." },
];

const demoMonitors = [
  { name: "Marketing site", ms: 84, bars: "uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu" },
  { name: "API", ms: 142, bars: "uuuuuuuuuuuuuuuuuuddduuuuuuuuu" },
  { name: "Checkout", ms: 97, bars: "uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu" },
];

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div className="absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
            <div className="animate-slide-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-700/40 dark:bg-brand-600/10 dark:text-brand-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-brand-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                </span>
                Free uptime monitoring
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Know your site is down{" "}
                <span className="bg-gradient-to-r from-brand-500 to-teal-400 bg-clip-text text-transparent">before your users do.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
                Uptime Monitor checks your websites around the clock, emails you the moment something breaks,
                and gives you a public status page to keep customers informed.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className={buttonClass("primary", "px-5 py-3 text-base")}>
                  Start monitoring free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/guide" className={buttonClass("secondary", "px-5 py-3 text-base")}>
                  See how it works
                </Link>
              </div>
              <p className="mt-4 text-sm text-zinc-500">
                No credit card. Or{" "}
                <Link href="/login" className="font-medium text-brand-600 hover:underline">try the demo account</Link>.
              </p>
            </div>

            {/* Live preview */}
            <Card className="relative animate-slide-up p-0 [animation-delay:150ms]">
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <p className="font-semibold">My Projects</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Zap className="h-3 w-3" /> Live
                </span>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {demoMonitors.map((m, i) => (
                  <li key={m.name} className="flex items-center gap-4 px-5 py-4">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-up opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-up" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.name}</p>
                      <div className="mt-2 flex h-6 items-end gap-[2px]">
                        {m.bars.split("").map((b, j) => (
                          <span
                            key={j}
                            className={`flex-1 rounded-sm ${b === "u" ? "bg-up/80" : "bg-down"} ${j === m.bars.length - 1 ? "animate-beat origin-bottom" : ""}`}
                            style={{ height: `${60 + ((j * 37 + i * 11) % 40)}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="w-14 text-right text-sm tabular-nums text-zinc-500">{m.ms} ms</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 border-t border-zinc-200 bg-red-50/60 px-5 py-3 text-sm dark:border-zinc-800 dark:bg-red-950/20">
                <BellRing className="h-4 w-4 shrink-0 text-red-500" />
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">API</span> was down for 3 min — we emailed you and it&apos;s resolved.
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-zinc-200 bg-white py-20 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight">Up and running in 2 minutes</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-zinc-600 dark:text-zinc-400">
              Think of it as a smoke alarm for your website.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="relative rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need, nothing you don&apos;t</h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="group p-6 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-600/10 dark:text-brand-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-20">
          <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-brand-600 to-teal-600 px-6 py-14 text-center text-white shadow-xl shadow-brand-600/20">
            <h2 className="text-3xl font-bold tracking-tight">Stop finding out from angry customers.</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-50">Add your first website in under a minute. Free while in beta.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-medium text-brand-700 transition hover:bg-brand-50">
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/status/demo" className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 font-medium text-white transition hover:bg-white/10">
                View demo status page
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
