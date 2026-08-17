import type { AppConfig } from "../config.ts";
import {
	AuthenticationInProgressError,
	CredentialsNotFoundError,
} from "../errors/types.ts";
import {
	clearSession,
	readCookies,
	sessionLooksReady,
	writeCookies,
	writeSourceState,
} from "../session/store.ts";
import {
	findChromeExecutable,
	readDevToolsWsUrl,
	resolveExistingChromeWsUrl,
	spawnChromeForLogin,
} from "./chrome-launch.ts";
import { browserManager } from "./manager.ts";

const LINKEDIN_URL = "https://www.linkedin.com";

async function persistSession(config: AppConfig): Promise<void> {
	const cookies = await browserManager.exportCookies();
	const linkedInCookies = cookies.filter(
		(c) =>
			c.domain.includes("linkedin.com") ||
			c.name === "li_at" ||
			c.name === "JSESSIONID",
	);
	await writeCookies(
		config.userDataDir,
		linkedInCookies.length ? linkedInCookies : cookies,
	);
	await writeSourceState(config.userDataDir, {
		runtime_id: crypto.randomUUID(),
		login_generation: Date.now(),
		updated_at: new Date().toISOString(),
		backend: "bun-webview-chrome",
	});
}

export async function ensureAuthenticated(config: AppConfig): Promise<void> {
	await browserManager.ensureReady(config);
	const loggedIn = await checkLogin();
	if (loggedIn) return;

	if (config.autoImportFromBrowser) {
		const cookies = await readCookies(config.userDataDir);
		if (cookies?.length) {
			await browserManager.importCookies(cookies);
			await browserManager.navigate(LINKEDIN_URL);
			if (await checkLogin()) return;
		}
	}

	if (config.loginInlineWait > 0) {
		console.error(
			`No session found. Waiting up to ${config.loginInlineWait}s for login…`,
		);
		const ok = await waitForLogin(config.loginInlineWait * 1000);
		if (ok) return;
		throw new AuthenticationInProgressError();
	}

	throw new CredentialsNotFoundError();
}

export async function checkLogin(): Promise<boolean> {
	try {
		await browserManager.navigate(`${LINKEDIN_URL}/feed/`);
		await Bun.sleep(1200);

		const href = await browserManager.evaluate<string>("window.location.href");
		const blockerPatterns = [
			"/login",
			"/authwall",
			"/checkpoint",
			"/challenge",
			"/signup",
		];
		if (blockerPatterns.some((p) => href.includes(p))) return false;

		const hasNav = await browserManager.evaluate<boolean>(
			"!!document.querySelector('.global-nav__primary-link, .global-nav__me, .search-global-typeahead, [data-global-nav-link], .share-box-feed-entry__trigger')",
		);
		if (hasNav) return true;

		if (href.includes("/feed") || href.includes("/in/")) return true;

		try {
			const cookies = await browserManager.exportCookies();
			if (cookies.some((c) => c.name === "li_at" && c.value.length > 10)) {
				return true;
			}
		} catch {
			// ignore
		}

		return false;
	} catch {
		return false;
	}
}

async function waitForLogin(timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await checkLogin()) return true;
		await Bun.sleep(1000);
	}
	return false;
}

export async function attachToExistingChrome(
	config: AppConfig,
): Promise<boolean> {
	const wsUrl = await resolveExistingChromeWsUrl(config.debugPort);
	if (!wsUrl) return false;
	console.error(`Attaching to existing Chrome DevTools: ${wsUrl}`);
	await browserManager.close();
	await browserManager.initialize(config, { attachWsUrl: wsUrl });
	return true;
}

export async function performLogin(config: AppConfig): Promise<void> {
	const existing = await resolveExistingChromeWsUrl(config.debugPort);
	if (existing) {
		console.error("Found existing Chrome with remote debugging — attaching…");
		await browserManager.close();
		await browserManager.initialize(config, { attachWsUrl: existing });
		if (await checkLogin()) {
			await persistSession(config);
			console.error("✓ LinkedIn session captured from existing Chrome.");
			await browserManager.close();
			return;
		}
		console.error(
			"Attached but not logged in yet — waiting for LinkedIn login in that Chrome…",
		);
		const timeoutMs =
			config.loginTimeout === 0
				? Number.POSITIVE_INFINITY
				: config.loginTimeout * 1000;
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			if (await checkLogin()) {
				await persistSession(config);
				console.error("✓ LinkedIn session saved.");
				await browserManager.close();
				return;
			}
			await Bun.sleep(1500);
		}
		await browserManager.close();
		throw new Error("Login timed out while attached to existing Chrome.");
	}

	const chromePath = findChromeExecutable(config.chromePath);
	if (!chromePath) {
		throw new Error(
			"Chrome/Edge not found. Install Chrome or set CHROME_PATH / --chrome-path. Or enable remote debugging on an already-running Chrome.",
		);
	}

	const loginProfile = `${config.userDataDir}/chrome-login`;
	console.error("Launching Chrome for LinkedIn login…");
	console.error(`  executable: ${chromePath}`);
	console.error(`  profile:    ${loginProfile}`);
	console.error(`  debug port: ${config.debugPort}`);

	const proc = spawnChromeForLogin({
		chromePath,
		userDataDir: loginProfile,
		debugPort: config.debugPort,
	});

	try {
		const wsUrl = await readDevToolsWsUrl(config.debugPort, 20_000);
		await browserManager.close();
		await browserManager.initialize(config, { attachWsUrl: wsUrl });

		const timeoutMs =
			config.loginTimeout === 0
				? Number.POSITIVE_INFINITY
				: config.loginTimeout * 1000;
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			if (await checkLogin()) {
				await persistSession(config);
				console.error(
					"✓ LinkedIn session saved (cookies.json + source-state.json).",
				);
				return;
			}
			await Bun.sleep(1500);
		}
		throw new Error("Login timed out. Run again with --login.");
	} finally {
		try {
			proc.kill();
		} catch {
			// ignore
		}
		await browserManager.close();
	}
}

export async function performLogout(config: AppConfig): Promise<void> {
	await clearSession(config.userDataDir);
	await browserManager.close();
	console.error(
		"✓ Session cleared (cookies.json / source-state.json removed).",
	);
}

export async function performStatus(config: AppConfig): Promise<number> {
	try {
		const attached = await attachToExistingChrome(config);
		if (!attached) {
			const ready = await sessionLooksReady(config.userDataDir);
			if (!ready) {
				console.error("status: no valid session files and no Chrome DevTools");
				return 1;
			}
			await browserManager.initialize(config);
			const cookies = await readCookies(config.userDataDir);
			if (cookies?.length) await browserManager.importCookies(cookies);
		}

		const ok = await checkLogin();
		if (ok) {
			await persistSession(config);
			console.error("status: authenticated");
			await browserManager.close();
			return 0;
		}
		console.error("status: not authenticated");
		await browserManager.close();
		return 1;
	} catch (err) {
		console.error(
			"status: error —",
			err instanceof Error ? err.message : String(err),
		);
		await browserManager.close();
		return 1;
	}
}

export async function performImportFromBrowser(
	config: AppConfig,
): Promise<void> {
	const attached = await attachToExistingChrome(config);
	if (attached && (await checkLogin())) {
		await persistSession(config);
		await browserManager.close();
		console.error("✓ Session imported from live Chrome DevTools.");
		return;
	}

	const cookies = await readCookies(config.userDataDir);
	if (!cookies?.length) {
		throw new Error(
			"No cookies.json and could not attach to Chrome DevTools. Enable remote debugging or run --login.",
		);
	}
	await browserManager.initialize(config, { injectCookies: cookies });
	const ok = await checkLogin();
	if (!ok) {
		await browserManager.close();
		throw new Error("Imported cookies did not yield an authenticated session.");
	}
	await persistSession(config);
	await browserManager.close();
	console.error("✓ Session imported and validated.");
}
