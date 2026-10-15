import { notFound } from "next/navigation";
import { requireUser } from "./session";

/** Comma-separated ADMIN_EMAILS, normalised. Empty = nobody is an admin. */
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(user: { email: string; emailVerified: Date | null }): boolean {
  // A verified email is required, so nobody can sign up as an admin address without owning it.
  return Boolean(user.emailVerified) && adminEmails().has(user.email.toLowerCase());
}

/** The signed-in admin, or a 404 (non-admins can't even tell the page exists). */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}
