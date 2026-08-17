/**
 * Locale-independent connection-state detection (port of connection.py).
 * Uses URL patterns + ARIA attribute presence — never label text values.
 */

import { browserManager } from "../browser/manager.ts";

export type ConnectionState =
	| "already_connected"
	| "pending"
	| "incoming_request"
	| "connectable"
	| "follow_only"
	| "self_profile"
	| "unavailable";

export interface ActionSignals {
	has_invite_anchor: boolean;
	has_compose_anchor_in_action_root: boolean;
	has_edit_intro_anchor: boolean;
	has_labeled_action_button: boolean;
	has_labeled_action_anchor: boolean;
	has_incoming_action_row: boolean;
}

/** @deprecated use ActionSignals */
export type ConnectionSignals = Partial<ActionSignals> & {
	selfProfile?: boolean;
	alreadyConnected?: boolean;
	pending?: boolean;
	incomingRequest?: boolean;
	connectable?: boolean;
	followOnly?: boolean;
	unavailable?: boolean;
	hasCustomInvite?: boolean;
	hasEditProfile?: boolean;
	hasComposeMessage?: boolean;
	hasAriaLabel?: boolean;
};

export function detectConnectionState(signals: ActionSignals): ConnectionState {
	if (signals.has_edit_intro_anchor) return "self_profile";
	if (signals.has_invite_anchor) return "connectable";
	if (signals.has_incoming_action_row) return "incoming_request";
	if (signals.has_labeled_action_anchor) return "pending";
	if (signals.has_compose_anchor_in_action_root) {
		if (signals.has_labeled_action_button) return "follow_only";
		return "already_connected";
	}
	return "unavailable";
}

export async function readActionSignals(username: string): Promise<ActionSignals> {
	const signals = await browserManager.evaluate<ActionSignals | null>((user: string) => {
		function findActionRoot(main: Element): Element | null {
			const composeAnchors = [...main.querySelectorAll('a[href*="/messaging/compose/"]')];
			for (const anchor of composeAnchors) {
				let el: Element | null = anchor.parentElement;
				while (el && el !== main) {
					const buttons = el.querySelectorAll("button");
					const anchors = el.querySelectorAll("a");
					if (buttons.length + anchors.length >= 2) {
						return el;
					}
					el = el.parentElement;
				}
			}
			return null;
		}

		function findIncomingActionRow(main: Element): Element | null {
			const scope = main.querySelector("section") || main.firstElementChild || main;
			const matches: Element[] = [];
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
							expanders[0]!.compareDocumentPosition(labeled[1]!) & Node.DOCUMENT_POSITION_PRECEDING &&
							!el.querySelector('a[href*="/messaging/compose/"]') &&
							!el.querySelector('a[href*="/preload/custom-invite/"]') &&
							!el.querySelector("a[aria-label]")
						) {
							matches.push(el);
						}
						break;
					}
					el = el.parentElement;
				}
			}
			return matches.length === 1 ? matches[0]! : null;
		}

		const main = document.querySelector("main");
		if (!main) {
			return {
				has_invite_anchor: false,
				has_compose_anchor_in_action_root: false,
				has_edit_intro_anchor: false,
				has_labeled_action_button: false,
				has_labeled_action_anchor: false,
				has_incoming_action_row: false,
			};
		}

		const safe = CSS.escape(user);
		const inviteSel = `a[href*="/preload/custom-invite/?vanityName=${safe}"]`;
		const editSel = `a[href*="/in/${safe}/edit/intro/"]`;

		const hasInvite = !!document.querySelector(inviteSel);
		const hasEditIntro = !!main.querySelector(editSel);
		const actionRoot = findActionRoot(main);

		let hasComposeInActionRoot = false;
		let hasLabeledActionButton = false;
		let hasLabeledActionAnchor = false;
		if (actionRoot) {
			hasComposeInActionRoot = !!actionRoot.querySelector('a[href*="/messaging/compose/"]');
			for (const b of actionRoot.querySelectorAll("button")) {
				if (b.hasAttribute("aria-label")) {
					hasLabeledActionButton = true;
					break;
				}
			}
			for (const a of actionRoot.querySelectorAll("a")) {
				if (a.hasAttribute("aria-label")) {
					hasLabeledActionAnchor = true;
					break;
				}
			}
		}

		return {
			has_invite_anchor: hasInvite,
			has_compose_anchor_in_action_root: hasComposeInActionRoot,
			has_edit_intro_anchor: hasEditIntro,
			has_labeled_action_button: hasLabeledActionButton,
			has_labeled_action_anchor: hasLabeledActionAnchor,
			has_incoming_action_row: !!findIncomingActionRow(main),
		};
	}, username);

	return (
		signals ?? {
			has_invite_anchor: false,
			has_compose_anchor_in_action_root: false,
			has_edit_intro_anchor: false,
			has_labeled_action_button: false,
			has_labeled_action_anchor: false,
			has_incoming_action_row: false,
		}
	);
}

/** @deprecated */
export async function detectConnectionSignals(username: string): Promise<ConnectionSignals> {
	const s = await readActionSignals(username);
	const state = detectConnectionState(s);
	return {
		...s,
		selfProfile: state === "self_profile",
		alreadyConnected: state === "already_connected",
		pending: state === "pending",
		incomingRequest: state === "incoming_request",
		connectable: state === "connectable",
		followOnly: state === "follow_only",
		unavailable: state === "unavailable",
		hasCustomInvite: s.has_invite_anchor,
		hasEditProfile: s.has_edit_intro_anchor,
		hasComposeMessage: s.has_compose_anchor_in_action_root,
	};
}

export function computeConnectionStatus(signals: ConnectionSignals): string {
	if (signals.has_invite_anchor !== undefined || signals.has_edit_intro_anchor !== undefined) {
		return detectConnectionState({
			has_invite_anchor: !!signals.has_invite_anchor,
			has_compose_anchor_in_action_root: !!signals.has_compose_anchor_in_action_root,
			has_edit_intro_anchor: !!signals.has_edit_intro_anchor,
			has_labeled_action_button: !!signals.has_labeled_action_button,
			has_labeled_action_anchor: !!signals.has_labeled_action_anchor,
			has_incoming_action_row: !!signals.has_incoming_action_row,
		});
	}
	if (signals.selfProfile) return "self_profile";
	if (signals.alreadyConnected) return "already_connected";
	if (signals.pending) return "pending";
	if (signals.incomingRequest) return "incoming_request";
	if (signals.connectable) return "connectable";
	if (signals.followOnly) return "follow_only";
	if (signals.unavailable) return "unavailable";
	return "unknown";
}
