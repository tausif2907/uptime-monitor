"use client";

import { BarChart3, BookOpen, LayoutDashboard, LifeBuoy, LogOut, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { cx } from "./ui";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: ["/dashboard", "/projects"] },
  { href: "/guide", label: "How it works", icon: BookOpen, match: ["/guide"] },
  { href: "/help", label: "Help", icon: LifeBuoy, match: ["/help"] },
  { href: "/account", label: "Account", icon: Settings, match: ["/account"] },
];

export function AppNav({ name, email, isDemo, isAdmin = false }: { name: string | null; email: string; isDemo: boolean; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initial = (name ?? email).trim().charAt(0).toUpperCase();

  const visibleLinks = isAdmin
    ? [...links, { href: "/admin", label: "Admin", icon: BarChart3, match: ["/admin"] }]
    : links;

  const linkEls = (mobile: boolean) =>
    visibleLinks.map(({ href, label, icon: Icon, match }) => {
      const active = match.some((m) => pathname.startsWith(m));
      return (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={active ? "page" : undefined}
          className={cx(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
            active
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
            mobile && "py-3",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      );
    });

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80">
      {isDemo && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          You&apos;re exploring the shared demo account — alerts are off and changes are reset nightly.{" "}
          <Link href="/signup" className="underline">Create your free account →</Link>
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <nav className="hidden items-center gap-1 md:flex">{linkEls(false)}</nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white" title={email}>
              {initial}
            </span>
            <form action={signOutAction}>
              <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white" title="Sign out">
                <LogOut className="h-4 w-4" />
                <span className="sr-only lg:not-sr-only">Sign out</span>
              </button>
            </form>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="space-y-1 border-t border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800 animate-fade-in">
          {linkEls(true)}
          <p className="px-3 pt-2 text-xs text-zinc-500">{email}</p>
          <form action={signOutAction}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </nav>
      )}
    </header>
  );
}
