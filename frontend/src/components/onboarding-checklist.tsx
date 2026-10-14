import { CheckCircle2, Circle, Rocket } from "lucide-react";
import Link from "next/link";
import { Card, cx } from "./ui";

export interface ChecklistState {
  hasProject: boolean;
  hasMonitor: boolean;
  hasCheck: boolean;
  hasAlerts: boolean;
  firstProjectId?: string;
  firstSlug?: string;
}

/** Getting-started guide on the dashboard; ticks itself off as the user goes. */
export function OnboardingChecklist(s: ChecklistState) {
  const steps = [
    {
      done: s.hasProject,
      title: "Create a project",
      body: "A project groups related websites and gets its own public status page.",
      href: "#new-project",
    },
    {
      done: s.hasMonitor,
      title: "Add your first monitor",
      body: "Paste the URL of a website you care about. Use “Test URL” to check it first.",
      href: s.firstProjectId ? `/projects/${s.firstProjectId}/monitors/new` : "#new-project",
    },
    {
      done: s.hasCheck,
      title: "Wait for the first check",
      body: "Our worker checks it within a minute. Status turns from Pending to Up.",
      href: s.firstProjectId ? `/projects/${s.firstProjectId}` : undefined,
    },
    {
      done: s.hasAlerts,
      title: "Turn on alerts",
      body: "We email you when a site goes down and again when it recovers.",
      href: s.firstProjectId ? `/projects/${s.firstProjectId}/settings` : undefined,
    },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Card className="mb-8 overflow-hidden p-0 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-gradient-to-r from-brand-50 to-transparent px-5 py-4 dark:border-zinc-800 dark:from-brand-600/10">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Rocket className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold">Get started</p>
            <p className="text-xs text-zinc-500">{doneCount} of {steps.length} done · <Link href="/guide" className="text-brand-600 hover:underline">read the 3-minute guide</Link></p>
          </div>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="grid gap-px bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4 dark:bg-zinc-800">
        {steps.map((step, i) => {
          const content = (
            <>
              <div className="flex items-center gap-2">
                {step.done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />}
                <span className={cx("text-sm font-medium", step.done && "text-zinc-400 line-through")}>
                  {i + 1}. {step.title}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">{step.body}</p>
            </>
          );
          return (
            <li key={step.title} className="bg-white p-4 dark:bg-zinc-900">
              {step.href && !step.done ? (
                <Link href={step.href} className="block rounded-lg transition hover:opacity-80">{content}</Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
