import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buttonClass } from "@/components/ui";

const features = [
  ["Checks every 1–5 minutes", "A background worker checks each URL with strict timeouts, so slow sites never slow the dashboard."],
  ["Incidents, not noise", "An incident opens after 2 consecutive failures and closes on the next success."],
  ["Email alerts", "One email when something goes down and one when it recovers — never duplicates."],
  ["Public status pages", "Share /status/your-project with 90 days of uptime history."],
];

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-4xl px-4 py-20">
      <p className="text-sm font-medium text-green-600">● All systems watched</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        Know your site is down before your users do.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
        Uptime Monitor checks your websites around the clock, records response times, alerts you
        by email and gives every project a public status page.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className={buttonClass("primary")}>
          Get started
        </Link>
        <Link href="/status/demo" className={buttonClass("secondary")}>
          View a demo status page
        </Link>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        {features.map(([title, body]) => (
          <div key={title}>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
