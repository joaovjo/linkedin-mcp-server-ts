import { browserManager } from "../browser/manager.ts";
import type { Reference } from "./link-metadata.ts";

function stripSelectConversationPrefix(ariaLabel: string): string {
	return ariaLabel
		.replace(/^Select conversation with\s+/i, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Click each visible messaging sidebar row and capture thread URLs.
 * LinkedIn sidebar has no hrefs — click-and-capture is required (Python parity).
 */
export async function extractConversationThreadRefs(
	limit: number | null,
	context: string,
	nameFilter?: string | null,
): Promise<Reference[]> {
	await browserManager.waitForSelector("main li label[aria-label]", 10000);

	const labels =
		(await browserManager.evaluate<
			Array<{ index: number; ariaLabel: string; name: string }>
		>((filter: string | null) => {
			const wanted = (filter || "").replace(/\s+/g, " ").trim().toLowerCase();
			const nodes = [...document.querySelectorAll("main li label[aria-label]")];
			const out: Array<{ index: number; ariaLabel: string; name: string }> = [];
			nodes.forEach((label, index) => {
				const ariaLabel = label.getAttribute("aria-label") || "";
				const name = ariaLabel
					.replace(/^Select conversation with\s+/i, "")
					.replace(/\s+/g, " ")
					.trim();
				if (wanted && name.toLowerCase() !== wanted) return;
				out.push({ index, ariaLabel, name });
			});
			return out;
		}, nameFilter ?? null)) ?? [];

	const cap = limit == null ? labels.length : Math.min(labels.length, limit);
	const refs: Reference[] = [];
	const seen = new Set<string>();

	for (let i = 0; i < cap; i++) {
		const row = labels[i]!;
		const before = await browserManager.getCurrentUrl();

		const clicked = await browserManager.evaluate<boolean>((idx: number) => {
			const labels = [
				...document.querySelectorAll("main li label[aria-label]"),
			];
			const label = labels[idx];
			if (!label) return false;
			const clickTarget =
				label.closest("li")?.querySelector('div[class*="listitem__link"]') ||
				label.closest("li") ||
				label;
			(clickTarget as HTMLElement).click();
			return true;
		}, row.index);

		if (!clicked) continue;

		let after = before;
		for (let w = 0; w < 12; w++) {
			await Bun.sleep(100);
			after = await browserManager.getCurrentUrl();
			if (after !== before && /\/messaging\/thread\//.test(after)) break;
		}

		const match = /\/messaging\/thread\/([^/?#]+)/.exec(after);
		if (!match?.[1] || seen.has(match[1])) continue;
		seen.add(match[1]);

		const ref: Reference = {
			kind: "conversation",
			url: `/messaging/thread/${match[1]}/`,
			context,
		};
		const name = stripSelectConversationPrefix(row.ariaLabel);
		if (name) ref.text = name;
		refs.push(ref);
	}

	return refs;
}

export async function readProfileDisplayName(): Promise<string | null> {
	return await browserManager.evaluate<string | null>(() => {
		const h1 = document.querySelector("main h1");
		const t = (h1?.textContent || "").replace(/\s+/g, " ").trim();
		return t || null;
	});
}

/** Resolve thread URLs for a participant display name via inbox (+ search fallback). */
export async function resolveConversationThreadUrls(
	displayName: string,
): Promise<string[]> {
	await browserManager.navigate("https://www.linkedin.com/messaging/");
	await Bun.sleep(1500);
	let refs = await extractConversationThreadRefs(null, "inbox", displayName);
	if (!refs.length) {
		await browserManager.navigate(
			`https://www.linkedin.com/messaging/?searchTerm=${encodeURIComponent(displayName)}`,
		);
		await Bun.sleep(1500);
		refs = await extractConversationThreadRefs(null, "search", displayName);
	}
	return refs.map((r) => `https://www.linkedin.com${r.url}`);
}
