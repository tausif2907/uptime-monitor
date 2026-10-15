"use client";

import { Area, Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyRow } from "@/lib/admin-stats";

const short = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

/** 30 days of page views (area), unique visitors (area) and sign-ups (bars). */
export function TrafficChart({ data }: { data: DailyRow[] }) {
  const empty = data.every((d) => d.views === 0 && d.signups === 0);
  if (empty) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        No visits recorded yet — open a few pages (in another browser, not signed in as admin) to see data here.
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
          <XAxis dataKey="day" tickFormatter={short} tick={{ fontSize: 12 }} stroke="currentColor" strokeOpacity={0.4} minTickGap={20} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" strokeOpacity={0.4} />
          <Tooltip labelFormatter={(d) => short(String(d))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="views" name="Page views" stroke="#10b981" fill="url(#views)" strokeWidth={2} />
          <Area type="monotone" dataKey="visitors" name="Unique visitors" stroke="#2563eb" fill="transparent" strokeWidth={2} />
          <Bar dataKey="signups" name="Sign-ups" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={14} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
