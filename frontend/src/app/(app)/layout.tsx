import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { isDemoEmail } from "@/lib/demo";
import { requireUser } from "@/lib/session";

/** Shell for every signed-in page. Authorization is enforced again inside each page/action. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <AppNav name={user.name} email={user.email} isDemo={isDemoEmail(user.email)} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}
