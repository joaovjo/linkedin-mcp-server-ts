export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  reqId?: string | null;
  conn_id?: string | null;
  [key: string]: unknown;
}

/**
 * Structured JSON logger for the extension. Emits one JSON line per event
 * (wide-event style, matching the server) via console.info / console.error
 * so logs are visible in chrome://extensions → service worker console.
 *
 * Each line includes: ts (ISO timestamp), level, event, plus optional
 * reqId / conn_id and any extra fields.
 */
export function log(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info(event: string, fields?: LogFields): void {
    log("info", event, fields);
  },
  warn(event: string, fields?: LogFields): void {
    log("warn", event, fields);
  },
  error(event: string, fields?: LogFields): void {
    log("error", event, fields);
  },
};
