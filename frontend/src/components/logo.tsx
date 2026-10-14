import Link from "next/link";
import { cx } from "./ui";

/** Brand green of the logo's "status dot". */
export const LOGO_GREEN = "#3DDC97";

/**
 * The Uptime mark: a rounded "U" whose right arm is an "i" with a green status dot.
 * Drawn with currentColor so it works on light and dark backgrounds.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-2 -2 144 171" className={cx("h-8 w-auto", className)} aria-hidden="true">
      <path
        d="M15 15 V97.5 A52.5 52.5 0 0 0 120 97.5 V79"
        fill="none"
        stroke="currentColor"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="120" cy="23" r="19" fill={LOGO_GREEN} />
    </svg>
  );
}

/** Mark + "uptime" wordmark. */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cx("group inline-flex items-center gap-2.5", className)} aria-label="Uptime — home">
      <LogoMark className="h-7 text-zinc-800 transition group-hover:scale-105 dark:text-zinc-100" />
      <span className="text-xl font-extrabold lowercase tracking-tight text-zinc-800 dark:text-zinc-100">uptime</span>
    </Link>
  );
}
