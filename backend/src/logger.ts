type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

// One JSON object per line: easy to grep locally and parsed natively by Railway/Render logs.
function write(level: Level, msg: string, fields?: Fields) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: Fields) => {
    if (process.env.LOG_LEVEL === "debug") write("debug", msg, fields);
  },
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
