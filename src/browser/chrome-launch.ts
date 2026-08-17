import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WIN_CANDIDATES = [
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
	join(
		process.env.LOCALAPPDATA ?? "",
		"Google\\Chrome\\Application\\chrome.exe",
	),
	"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
	"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const UNIX_NAMES = [
	"google-chrome-stable",
	"google-chrome",
	"chromium-browser",
	"chromium",
	"brave-browser",
	"microsoft-edge",
	"chrome",
];

export function findChromeExecutable(explicit?: string): string | null {
	if (explicit && existsSync(explicit)) return explicit;
	if (Bun.env.BUN_CHROME_PATH && existsSync(Bun.env.BUN_CHROME_PATH)) {
		return Bun.env.BUN_CHROME_PATH;
	}
	if (Bun.env.CHROME_PATH && existsSync(Bun.env.CHROME_PATH)) {
		return Bun.env.CHROME_PATH;
	}

	for (const name of UNIX_NAMES) {
		const found = Bun.which(name);
		if (found) return found;
	}

	if (process.platform === "win32") {
		for (const path of WIN_CANDIDATES) {
			if (path && existsSync(path)) return path;
		}
	}

	if (process.platform === "darwin") {
		const mac = [
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
		];
		for (const path of mac) {
			if (existsSync(path)) return path;
		}
	}

	return null;
}

export function readDevToolsActivePortWsUrl(
	userDataRoots: string[] = [
		join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "User Data"),
		join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "User Data"),
		join(
			process.env.LOCALAPPDATA ?? "",
			"BraveSoftware",
			"Brave-Browser",
			"User Data",
		),
	],
): string | null {
	for (const root of userDataRoots) {
		const file = join(root, "DevToolsActivePort");
		if (!existsSync(file)) continue;
		try {
			const [port, path] = readFileSync(file, "utf8").trim().split(/\r?\n/);
			if (port && path) {
				return `ws://127.0.0.1:${port}${path}`;
			}
		} catch {
			// try next
		}
	}
	return null;
}

export async function readDevToolsWsUrl(
	port: number,
	timeoutMs = 15_000,
): Promise<string> {
	const fromFile = readDevToolsActivePortWsUrl();
	if (fromFile?.includes(`:${port}`)) {
		return fromFile;
	}

	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		const active = readDevToolsActivePortWsUrl();
		if (active) return active;

		try {
			const res = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (res.ok) {
				const data = (await res.json()) as { webSocketDebuggerUrl?: string };
				if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
			} else {
				lastError = new Error(`HTTP ${res.status}`);
			}
		} catch (err) {
			lastError = err;
		}
		await Bun.sleep(250);
	}
	throw new Error(
		`Chrome DevTools endpoint not ready on port ${port}: ${
			lastError instanceof Error ? lastError.message : String(lastError ?? "")
		}`,
	);
}

export async function resolveExistingChromeWsUrl(
	debugPort = 9222,
): Promise<string | null> {
	const active = readDevToolsActivePortWsUrl();
	if (active) return active;
	try {
		return await readDevToolsWsUrl(debugPort, 2_000);
	} catch {
		return null;
	}
}

export function spawnChromeForLogin(opts: {
	chromePath: string;
	userDataDir: string;
	debugPort: number;
}): Bun.Subprocess {
	return Bun.spawn(
		[
			opts.chromePath,
			`--remote-debugging-port=${opts.debugPort}`,
			`--user-data-dir=${opts.userDataDir}`,
			"--no-first-run",
			"--no-default-browser-check",
			"https://www.linkedin.com/login",
		],
		{
			stdout: "ignore",
			stderr: "ignore",
			stdin: "ignore",
		},
	);
}
