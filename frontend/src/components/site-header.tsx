import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { buttonClass } from "./ui";

/** Header for public pages (landing, guide, help, auth). */
export async function SiteHeader() {
  const session = await auth();
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/70 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/guide" className="hidden rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 sm:inline dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
            How it works
          </Link>
          <Link href="/help" className="hidden rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 sm:inline dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
            Help
          </Link>
          <ThemeToggle />
          {session?.user ? (
            <Link href="/dashboard" className={buttonClass("primary", "ml-1 py-2")}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "py-2")}>
                Sign in
              </Link>
              <Link href="/signup" className={buttonClass("primary", "py-2")}>
                Sign up free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 py-10 text-sm text-zinc-500 dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
        <p>© {new Date().getFullYear()} Uptime Monitor</p>
        <nav className="flex gap-5">
          <Link href="/guide" className="hover:text-zinc-900 dark:hover:text-white">How it works</Link>
          <Link href="/help" className="hover:text-zinc-900 dark:hover:text-white">Help & FAQ</Link>
          <Link href="/status/demo" className="hover:text-zinc-900 dark:hover:text-white">Demo status page</Link>
        </nav>
      </div>
    </footer>
  );
}
