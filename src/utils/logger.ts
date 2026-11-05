/**
 * Structured JSON logging with wide events.
 *
 * Each log call emits exactly one JSON line to stderr (via `console.error`) so
 * stdout stays reserved for the MCP protocol. Fields are high-cardinality and
 * dimensional: callers pass event names, request/connection IDs, timings and
 * error details on every event instead of free-form strings.
 *
 * @remarks
 * Only Bun and standard Web APIs are used (`crypto.randomUUID`,
 * `console.error`). No Node/npm-specific APIs.
 */

/** Severity levels understood by the logger. `WARNING` is normalized to `WARN`. */
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type LogFields = Record<string, unknown>;

export interface Logger {
	debug: (event: string, fields?: LogFields) => void;
	info: (event: string, fields?: LogFields) => void;
	warn: (event: string, fields?: LogFields) => void;
	error: (event: string, fields?: LogFields) => void;
}

export interface LoggerOptions {
	/** Component name attached to every event as `module`. */
	module: string;
	/** Optional request ID attached to every event as `req_id`. */
	reqId?: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
};

let configuredLevel: LogLevel = "INFO";

/**
 * Normalizes free-form configured levels (`DEBUG`, `INFO`, `WARNING`, `ERROR`)
 * to the canonical {@link LogLevel} values. Unknown values fall back to `INFO`.
 */
export function normalizeLogLevel(raw?: string | null): LogLevel {
	const value = (raw ?? "").trim().toUpperCase();
	if (value === "DEBUG") return "DEBUG";
	if (value === "WARNING" || value === "WARN") return "WARN";
	if (value === "ERROR") return "ERROR";
	return "INFO";
}

/** Sets the minimum level for subsequent log calls. Invalid values fall back to `INFO`. */
export function setLogLevel(level?: string | null): void {
	configuredLevel = normalizeLogLevel(level);
}

/** Returns the currently configured log level. */
export function getLogLevel(): LogLevel {
	return configuredLevel;
}

/** Returns whether `DEBUG` logging is enabled with the current configuration. */
export function isDebugEnabled(): boolean {
	return configuredLevel === "DEBUG";
}

/**
 * Decides whether a log at `level` should be emitted.
 *
 * `DEBUG` logs are emitted only when the configured level is `DEBUG`. When the
 * configured level is `ERROR`, only `ERROR` logs are emitted. Otherwise
 * (`DEBUG`, `INFO`, or `WARNING`/`WARN`) `INFO` and above are emitted, which
 * keeps startup/bridge diagnostics visible under the default `WARNING` config.
 */
export function isLevelEnabled(level: LogLevel): boolean {
	if (level === "DEBUG") return configuredLevel === "DEBUG";
	if (configuredLevel === "ERROR") return level === "ERROR";
	return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY.INFO;
}

/** Creates a fresh UUID request ID for correlating wide events. */
export function createReqId(): string {
	return crypto.randomUUID();
}

/** Serializes an `Error` value into a JSON-safe object; other values pass through. */
export function serializeError(value: unknown): unknown {
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
		};
	}
	return value;
}

/** Converts `Error` instances in `fields` to JSON-safe objects. */
export function sanitizeFields(fields: LogFields): LogFields {
	const sanitized: LogFields = {};
	for (const [key, value] of Object.entries(fields)) {
		sanitized[key] = value instanceof Error ? serializeError(value) : value;
	}
	return sanitized;
}

/**
 * Emits one structured JSON log line to stderr.
 *
 * @param level - Severity level (`DEBUG`, `INFO`, `WARN`, `ERROR`).
 * @param event - Stable, machine-readable event name (e.g. `client_connected`).
 * @param fields - High-cardinality dimensions (IDs, timings, status, errors).
 * @example
 * ```ts
 * log("INFO", "extract_request", { req_id: "abc", target: "person", timeout_ms: 15000 });
 * ```
 */
export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
	if (!isLevelEnabled(level)) return;
	const payload = {
		ts: new Date().toISOString(),
		level,
		event,
		...sanitizeFields(fields),
	};
	console.error(JSON.stringify(payload));
}

/**
 * Convenience wrapper around {@link log} with an explicit level parameter.
 *
 * @example
 * ```ts
 * logEvent("http_request", { req_id: id, duration_ms: 12 }, "INFO");
 * ```
 */
export function logEvent(event: string, fields: LogFields = {}, level: LogLevel = "INFO"): void {
	log(level, event, fields);
}

/**
 * Creates a component-scoped logger that stamps `module` (and optionally
 * `req_id`) onto every event it emits.
 *
 * @example
 * ```ts
 * const log = createLogger({ module: "bridge" });
 * log.info("client_connected", { conn_id: "conn-1" });
 * ```
 */
export function createLogger(options: LoggerOptions): Logger {
	const { module: moduleName, reqId } = options;
	const write =
		(level: LogLevel) =>
		(event: string, fields: LogFields = {}) => {
			const merged: LogFields = { module: moduleName };
			if (reqId !== undefined) merged.req_id = reqId;
			log(level, event, { ...merged, ...fields });
		};
	return {
		debug: write("DEBUG"),
		info: write("INFO"),
		warn: write("WARN"),
		error: write("ERROR"),
	};
}
