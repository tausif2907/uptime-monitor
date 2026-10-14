import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card } from "@/components/ui";

const perks = [
  "Checks every minute from our servers",
  "Email alerts the moment a site goes down",
  "A public status page for every project",
  "Two-factor authentication for your account",
];

/** Two-column layout for sign-in / sign-up / password pages. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-emerald-600 to-teal-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid absolute inset-0 opacity-30" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Uptime — home">
            <LogoMark className="h-8 text-white" />
            <span className="text-2xl font-extrabold lowercase tracking-tight">uptime</span>
          </Link>
        </div>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">Sleep well. We&apos;ll watch your websites.</h2>
          <ul className="mt-8 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-brand-50">
                <CheckCircle2 className="h-5 w-5 text-white" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-100">Free while in beta · No credit card</p>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <span className="lg:hidden">
            <Logo />
          </span>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12">
          <div className="w-full max-w-md animate-slide-up">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>}
            <Card className="mt-6 space-y-5 p-6">{children}</Card>
            {footer && <div className="mt-6 text-center text-sm text-zinc-500">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      {label}
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
