import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-zinc-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-zinc-500">It may have been deleted, or you don&apos;t have access to it.</p>
      <Link href="/" className={buttonClass("secondary", "mt-6")}>
        Go home
      </Link>
    </main>
  );
}
