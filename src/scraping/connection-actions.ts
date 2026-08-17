import { browserManager } from "../browser/manager.ts";
import {
	type ActionSignals,
	detectConnectionState,
	readActionSignals,
} from "./connection.ts";
import { extractPersonProfile } from "./extractor.ts";

const LINKEDIN_BASE = "https://www.linkedin.com";

function connectionResult(
	url: string,
	status: string,
	message: string,
	extra: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		url,
		status,
		message,
		note_sent: extra.note_sent ?? false,
		...extra,
	};
}

async function openMoreMenu(): Promise<boolean> {
	return await browserManager.evaluate<boolean>(() => {
		const main = document.querySelector("main");
		if (!main) return false;
		const expanders = [
			...main.querySelectorAll("button[aria-expanded]"),
		] as HTMLButtonElement[];
		const more = expanders.find((b) => !b.hasAttribute("aria-label"));
		if (!more) return false;
		more.click();
		return true;
	});
}

async function clickIncomingAccept(): Promise<boolean> {
	return await browserManager.evaluate<boolean>(() => {
		const main = document.querySelector("main");
		if (!main) return false;
		const scope =
			main.querySelector("section") || main.firstElementChild || main;
		for (const expander of scope.querySelectorAll("button[aria-expanded]")) {
			let el: Element | null = expander.parentElement;
			while (el && el !== scope && el !== main) {
				if (el.querySelectorAll("button").length >= 2) {
					const buttons = el.querySelectorAll("button");
					const labeled = el.querySelectorAll("button[aria-label]");
					const expanders = el.querySelectorAll("button[aria-expanded]");
					if (
						buttons.length === 3 &&
						labeled.length === 2 &&
						expanders.length === 1 &&
						!expanders[0]!.hasAttribute("aria-label") &&
						!el.querySelector('a[href*="/messaging/compose/"]') &&
						!el.querySelector('a[href*="/preload/custom-invite/"]') &&
						!el.querySelector("a[aria-label]")
					) {
						(labeled[0] as HTMLButtonElement).click();
						return true;
					}
					break;
				}
				el = el.parentElement;
			}
		}
		return false;
	});
}

async function getPremiumUpsellMessage(): Promise<string | null> {
	return await browserManager.evaluate<string | null>(() => {
		const dialog =
			document.querySelector("dialog[open]") ||
			document.querySelector('[role="dialog"]');
		if (!dialog) return null;
		const premiumLink = dialog.querySelector('a[href*="/premium/"]');
		if (!premiumLink) return null;
		const text = (dialog as HTMLElement).innerText || "";
		const cleaned = text.replace(/\s+/g, " ").trim();
		return cleaned || null;
	});
}

async function dialogIsOpen(): Promise<boolean> {
	return await browserManager.evaluate<boolean>(
		`() => !!(document.querySelector('dialog[open], [role="dialog"]'))`,
	);
}

async function dismissDialog(): Promise<void> {
	await browserManager.evaluate(() => {
		const btn = document.querySelector(
			'dialog[open] button[aria-label*="Dismiss"], [role="dialog"] button[aria-label*="Dismiss"], dialog[open] button[aria-label*="Close"], [role="dialog"] button[aria-label*="Close"]',
		) as HTMLButtonElement | null;
		if (btn) btn.click();
		else
			document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
	});
	await Bun.sleep(300);
}

async function submitInviteDialog(note?: string): Promise<{
	submitted: boolean;
	note_sent: boolean;
	note_limit_message: string | null;
}> {
	await Bun.sleep(1200);
	if (!(await dialogIsOpen())) {
		return { submitted: false, note_sent: false, note_limit_message: null };
	}

	let noteFilled = false;
	if (note) {
		const hasTextarea = await browserManager.waitForSelector(
			'[role="dialog"] textarea, dialog textarea',
			1500,
		);
		if (!hasTextarea) {
			// Click secondary button (Add a note) — positional: btn_count - 2
			await browserManager.evaluate(() => {
				const dialog =
					document.querySelector("dialog[open]") ||
					document.querySelector('[role="dialog"]');
				if (!dialog) return;
				const buttons = [
					...dialog.querySelectorAll("button, [role='button']"),
				] as HTMLElement[];
				if (buttons.length >= 2) buttons[buttons.length - 2]!.click();
			});
			await Bun.sleep(800);
			const upsell = await getPremiumUpsellMessage();
			if (upsell) {
				await dismissDialog();
				return {
					submitted: false,
					note_sent: false,
					note_limit_message: upsell,
				};
			}
		}

		const boxReady = await browserManager.waitForSelector(
			'[role="dialog"] textarea, dialog textarea',
			3000,
		);
		if (!boxReady) {
			const upsell = await getPremiumUpsellMessage();
			await dismissDialog();
			return {
				submitted: false,
				note_sent: false,
				note_limit_message: upsell,
			};
		}
		await browserManager.click('[role="dialog"] textarea, dialog textarea');
		await browserManager.type(note.slice(0, 300));
		noteFilled = true;
		await Bun.sleep(300);
	}

	const sent = await browserManager.evaluate<boolean>(() => {
		const dialog =
			document.querySelector("dialog[open]") ||
			document.querySelector('[role="dialog"]');
		if (!dialog) return false;
		const buttons = [
			...dialog.querySelectorAll("button, [role='button']"),
		] as HTMLButtonElement[];
		if (!buttons.length) return false;
		const primary = buttons[buttons.length - 1]!;
		if (primary.disabled) return false;
		primary.click();
		return true;
	});

	if (!sent) {
		if (note) {
			const upsell = await getPremiumUpsellMessage();
			if (upsell) {
				await dismissDialog();
				return {
					submitted: false,
					note_sent: false,
					note_limit_message: upsell,
				};
			}
		}
		await dismissDialog();
		return { submitted: false, note_sent: false, note_limit_message: null };
	}

	if (note) {
		await Bun.sleep(500);
		const upsell = await getPremiumUpsellMessage();
		if (upsell) {
			await dismissDialog();
			return {
				submitted: false,
				note_sent: false,
				note_limit_message: upsell,
			};
		}
	}

	await Bun.sleep(800);
	return { submitted: true, note_sent: noteFilled, note_limit_message: null };
}

export async function connectWithPerson(
	linkedinUsername: string,
	note?: string,
): Promise<Record<string, unknown>> {
	const url = `${LINKEDIN_BASE}/in/${linkedinUsername}/`;
	const main = await extractPersonProfile(linkedinUsername);
	const pageText = main.text;

	if (!pageText) {
		return connectionResult(
			url,
			"unavailable",
			"Could not read profile page.",
			{ profile: "" },
		);
	}

	let signals: ActionSignals = await readActionSignals(linkedinUsername);
	let state = detectConnectionState(signals);

	if (state === "self_profile") {
		return connectionResult(
			url,
			"connect_unavailable",
			"Cannot send a connection request to your own profile.",
			{ profile: pageText },
		);
	}
	if (state === "already_connected") {
		return connectionResult(
			url,
			"already_connected",
			"You are already connected with this profile.",
			{ profile: pageText },
		);
	}
	if (state === "pending") {
		return connectionResult(
			url,
			"pending",
			"A connection request is already pending for this profile.",
			{ profile: pageText },
		);
	}

	if (state === "incoming_request") {
		const clicked = await clickIncomingAccept();
		if (!clicked) {
			return connectionResult(
				url,
				"send_failed",
				"Could not find or click the Accept button.",
				{ profile: pageText },
			);
		}
		await Bun.sleep(3000);
		signals = await readActionSignals(linkedinUsername);
		state = detectConnectionState(signals);
		if (state !== "already_connected") {
			return connectionResult(
				url,
				"send_failed",
				"Accepted, but the profile did not transition to 1st-degree.",
				{ profile: pageText },
			);
		}
		return connectionResult(url, "accepted", "Connection request accepted.", {
			profile: pageText,
		});
	}

	if (state === "follow_only") {
		const opened = await openMoreMenu();
		if (opened) {
			await Bun.sleep(600);
			signals = await readActionSignals(linkedinUsername);
			try {
				await browserManager.press("Escape");
			} catch {
				/* ignore */
			}
		}
	}

	const inviteUrl = `${LINKEDIN_BASE}/preload/custom-invite/?vanityName=${encodeURIComponent(linkedinUsername)}`;

	if (!signals.has_invite_anchor) {
		if (note) {
			await browserManager.navigate(inviteUrl);
			const upsell = await (async () => {
				await Bun.sleep(1000);
				if (!(await dialogIsOpen())) return null;
				await browserManager.evaluate(() => {
					const dialog =
						document.querySelector("dialog[open]") ||
						document.querySelector('[role="dialog"]');
					if (!dialog) return;
					const buttons = [
						...dialog.querySelectorAll("button, [role='button']"),
					] as HTMLElement[];
					if (buttons.length >= 2) buttons[buttons.length - 2]!.click();
				});
				await Bun.sleep(800);
				const msg = await getPremiumUpsellMessage();
				await dismissDialog();
				return msg;
			})();
			if (upsell) {
				return connectionResult(url, "custom_note_limit_reached", upsell, {
					note_sent: false,
					profile: pageText,
				});
			}
		}
		return connectionResult(
			url,
			"connect_unavailable",
			"LinkedIn did not expose a usable Connect action for this profile.",
			{ profile: pageText },
		);
	}

	await browserManager.navigate(inviteUrl);
	const { submitted, note_sent, note_limit_message } =
		await submitInviteDialog(note);

	if (note_limit_message) {
		return connectionResult(
			url,
			"custom_note_limit_reached",
			note_limit_message,
			{ note_sent: false, profile: pageText },
		);
	}
	if (!submitted) {
		return connectionResult(
			url,
			"connect_unavailable",
			"LinkedIn did not open a usable invite dialog for this profile.",
			{ profile: pageText },
		);
	}

	// Verify invite anchor gone (request sent)
	await browserManager.navigate(url);
	await Bun.sleep(1500);
	const after = await readActionSignals(linkedinUsername);
	if (after.has_invite_anchor) {
		return connectionResult(
			url,
			"send_failed",
			"Invite dialog submitted, but Connect action is still available.",
			{ note_sent, profile: pageText },
		);
	}

	return connectionResult(
		url,
		"connected",
		note_sent
			? "Connection request sent with note."
			: "Connection request sent.",
		{ note_sent, profile: pageText },
	);
}
