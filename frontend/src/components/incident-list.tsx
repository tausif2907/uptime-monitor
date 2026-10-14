import { formatDateTime, formatDuration } from "@/lib/format";

interface IncidentItem {
  id: string;
  startedAt: Date;
  resolvedAt: Date | null;
  cause: string | null;
}

export function IncidentList({
  incidents,
  showCause = true,
}: {
  incidents: IncidentItem[];
  showCause?: boolean;
}) {
  if (incidents.length === 0) {
    return <p className="text-sm text-zinc-500">No incidents recorded.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
      {incidents.map((incident) => (
        <li key={incident.id} className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="font-medium">
              {incident.resolvedAt ? (
                <span className="text-zinc-700 dark:text-zinc-300">Resolved</span>
              ) : (
                <span className="text-red-600">Ongoing</span>
              )}
              <span className="ml-2 font-normal text-zinc-500">
                {formatDateTime(incident.startedAt)}
              </span>
            </p>
            {showCause && incident.cause && (
              <p className="mt-0.5 truncate text-xs text-zinc-500">{incident.cause}</p>
            )}
          </div>
          <span className="shrink-0 tabular-nums text-zinc-500">
            {formatDuration(incident.startedAt, incident.resolvedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
