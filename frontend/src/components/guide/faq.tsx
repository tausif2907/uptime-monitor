"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui";

export interface FaqItem {
  id?: string;
  category: string;
  q: string;
  a: ReactNode;
  /** Plain-text version of the answer for searching. */
  keywords: string;
}

/** Searchable, collapsible FAQ. */
export function Faq({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.q} ${i.keywords} ${i.category}`.toLowerCase().includes(q));
  }, [items, query]);

  const categories = [...new Set(filtered.map((i) => i.category))];

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help — e.g. “down but works”, “email”, “2FA”…"
          className="pl-10 py-3 text-base"
          aria-label="Search help articles"
        />
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-sm text-zinc-500">No answers match “{query}”. Try another word, or contact us below.</p>
      )}
      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{cat}</h2>
          <div className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60">
            {filtered
              .filter((i) => i.category === cat)
              .map((item) => (
                <details key={item.q} id={item.id} className="group scroll-mt-24" open={Boolean(query)}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    {item.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="space-y-2 px-5 pb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.a}</div>
                </details>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
