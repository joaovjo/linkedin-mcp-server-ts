import { join } from "node:path";
import { mkdir } from "node:fs/promises";

export interface SourceState {
	runtime_id: string;
	login_generation: number;
	updated_at: string;
	backend: "bun-webview-chrome";
}

export interface CookieRecord {
	name: string;
	value: string;
	domain: string;
	path: string;
	expires?: number;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: "Strict" | "Lax" | "None";
}

function rootDir(userDataDir: string): string {
	return join(userDataDir, "..");
}

export function cookiesPath(userDataDir: string): string {
	return join(rootDir(userDataDir), "cookies.json");
}

export function sourceStatePath(userDataDir: string): string {
	return join(rootDir(userDataDir), "source-state.json");
}

export function webViewProfilePath(userDataDir: string): string {
	return join(userDataDir, "bun-webview");
}

export async function ensureSessionDirs(userDataDir: string): Promise<void> {
	await mkdir(userDataDir, { recursive: true });
	await mkdir(webViewProfilePath(userDataDir), { recursive: true });
	await mkdir(rootDir(userDataDir), { recursive: true });
}

export async function readCookies(
	userDataDir: string,
): Promise<CookieRecord[] | null> {
	const path = cookiesPath(userDataDir);
	const file = Bun.file(path);
	if (!(await file.exists())) return null;
	try {
		const data = await file.json();
		if (Array.isArray(data)) return data as CookieRecord[];
		if (data && typeof data === "object" && Array.isArray(data.cookies)) {
			return data.cookies as CookieRecord[];
		}
		return null;
	} catch {
		return null;
	}
}

export async function writeCookies(
	userDataDir: string,
	cookies: CookieRecord[],
): Promise<void> {
	await ensureSessionDirs(userDataDir);
	await Bun.write(cookiesPath(userDataDir), JSON.stringify(cookies, null, 2));
}

export async function readSourceState(
	userDataDir: string,
): Promise<SourceState | null> {
	const path = sourceStatePath(userDataDir);
	const file = Bun.file(path);
	if (!(await file.exists())) return null;
	try {
		return (await file.json()) as SourceState;
	} catch {
		return null;
	}
}

export async function writeSourceState(
	userDataDir: string,
	state: SourceState,
): Promise<void> {
	await ensureSessionDirs(userDataDir);
	await Bun.write(sourceStatePath(userDataDir), JSON.stringify(state, null, 2));
}

export async function clearSession(userDataDir: string): Promise<void> {
	const { unlink } = await import("node:fs/promises");
	for (const path of [cookiesPath(userDataDir), sourceStatePath(userDataDir)]) {
		try {
			await unlink(path);
		} catch {
			// ignore missing
		}
	}
}

export async function sessionLooksReady(userDataDir: string): Promise<boolean> {
	const cookies = await readCookies(userDataDir);
	const state = await readSourceState(userDataDir);
	if (!cookies || cookies.length === 0 || !state) return false;
	return cookies.some((c) => c.name === "li_at" || c.name === "JSESSIONID");
}

export function cookiesToHeader(cookies: CookieRecord[]): string {
	const map = new Bun.CookieMap(
		cookies.map((c) => [c.name, c.value] as [string, string]),
	);
	return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
