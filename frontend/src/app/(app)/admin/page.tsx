import {
  Activity,
  AlertTriangle,
  BellRing,
  Eye,
  MonitorSmartphone,
  MousePointerClick,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TrafficChart } from "@/components/admin/traffic-chart";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { getAdminStats } from "@/lib/admin-stats";
import { formatDateTime, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

function Ranked({ title, icon, rows, empty }: { title: string; icon: ReactNode; rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 font-semibold">{icon} {title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="relative overflow-hidden rounded-lg px-3 py-1.5">
              <span className="absolute inset-y-0 left-0 rounded-lg bg-brand-500/10" style={{ width: `${(r.count / max) * 100}%` }} />
              <span className="relative flex justify-between gap-3">
                <span className="truncate font-mono text-xs">{r.label}</span>
                <span className="tabular-nums text-zinc-500">{r.count}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const s = await getAdminStats();
  const { users: u, usage, traffic } = s;

  return (
    <>
      <PageHeader
        title="Admin"
        description="Private to you. Visitors are counted without cookies; bots and Do-Not-Track browsers are ignored."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Visitors</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Visitors today" value={traffic.d1.visitors} icon={<Eye className="h-4 w-4" />} tone="up" />
        <Stat label="Visitors 7 days" value={traffic.d7.visitors} icon={<Users className="h-4 w-4" />} />
        <Stat label="Visitors 30 days" value={traffic.d30.visitors} icon={<Users className="h-4 w-4" />} />
        <Stat label="Page views 30 days" value={traffic.d30.views} icon={<MousePointerClick className="h-4 w-4" />} />
      </div>

      <Card className="mb-6">
        <h2 className="mb-1 font-semibold">Last 30 days</h2>
        <p className="mb-4 text-xs text-zinc-500">Daily page views, unique visitors and new sign-ups (UTC).</p>
        <TrafficChart data={s.daily} />
      </Card>

      <div className="mb-10 grid gap-6 lg:grid-cols-3">
        <Ranked title="Top pages" icon={<Eye className="h-4 w-4 text-brand-600" />} rows={s.topPages} empty="No page views yet." />
        <Ranked title="Where visitors come from" icon={<MousePointerClick className="h-4 w-4 text-brand-600" />} rows={s.topReferrers} empty="No external referrers yet — share your link!" />
        <Ranked title="Devices" icon={<MonitorSmartphone className="h-4 w-4 text-brand-600" />} rows={s.devices} empty="No data yet." />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Users</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total users" value={u.total} icon={<Users className="h-4 w-4" />} />
        <Stat label="New (today / 7d / 30d)" value={`${u.new1d} / ${u.new7d} / ${u.new30d}`} icon={<UserPlus className="h-4 w-4" />} tone="up" />
        <Stat label="Activated (has a monitor)" value={`${u.activated} · ${pct(u.activated, u.total)}`} icon={<UserCheck className="h-4 w-4" />} tone="up" />
        <Stat label="Active last 7 days" value={u.active7d} icon={<Activity className="h-4 w-4" />} />
      </div>
      <p className="mb-6 text-xs text-zinc-500">
        {u.verified} of {u.total} verified their email ({pct(u.verified, u.total)}) · {u.twoFactor} use two-factor authentication.
      </p>

      <Card className="mb-10 overflow-x-auto p-0">
        <h2 className="px-5 pt-5 font-semibold">Recent sign-ups</h2>
        <table className="mt-3 w-full min-w-[720px] text-sm">
          <thead className="border-y border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-5 py-2.5 font-medium">User</th>
              <th className="px-5 py-2.5 font-medium">Sign-in</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium">Monitors</th>
              <th className="px-5 py-2.5 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {s.recentUsers.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-2.5">
                  <p className="font-medium">{r.name ?? "—"}</p>
                  <p className="text-xs text-zinc-500">{r.email}</p>
                </td>
                <td className="px-5 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {r.methods.map((m) => <Badge key={m} className="capitalize">{m}</Badge>)}
                  </div>
                </td>
                <td className="px-5 py-2.5 text-xs">
                  {r.verified ? <span className="text-emerald-600">Verified</span> : <span className="text-amber-600">Unverified</span>}
                  {r.twoFactor && <span className="ml-2 inline-flex items-center gap-0.5 text-brand-600"><ShieldCheck className="h-3 w-3" />2FA</span>}
                </td>
                <td className="px-5 py-2.5 tabular-nums">{r.monitors}</td>
                <td className="px-5 py-2.5 text-xs text-zinc-500" title={formatDateTime(r.createdAt)}>{timeAgo(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">System</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Projects / monitors" value={`${usage.projects} / ${usage.monitors}`} icon={<Activity className="h-4 w-4" />} />
        <Stat label="Monitors down now" value={usage.down} icon={<AlertTriangle className="h-4 w-4" />} tone={usage.down ? "down" : "neutral"} />
        <Stat label="Checks last 24h" value={usage.checks24h.toLocaleString()} icon={<Activity className="h-4 w-4" />} tone="up" />
        <Stat label="Alerts sent 7d" value={usage.alertsSent7d} icon={<BellRing className="h-4 w-4" />} tone={usage.alertsFailed7d ? "down" : "neutral"} />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {usage.failedChecks24h} failed checks in 24h ({pct(usage.failedChecks24h, usage.checks24h)}) · {usage.openIncidents} open incidents ·{" "}
        {usage.incidents7d} incidents this week · {usage.paused} paused monitors · {usage.alertsFailed7d} alerts failed to send this week
      </p>
    </>
  );
}
