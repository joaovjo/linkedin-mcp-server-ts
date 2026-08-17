import { describe, expect, test } from "bun:test";
import { type ActionSignals, type ConnectionState, detectConnectionState } from "../../src/scraping/connection.ts";

describe("Unit: connection-state", () => {
	const baseSignals: ActionSignals = {
		has_invite_anchor: false,
		has_compose_anchor_in_action_root: false,
		has_edit_intro_anchor: false,
		has_labeled_action_button: false,
		has_labeled_action_anchor: false,
		has_incoming_action_row: false,
	};

	test("detects connectable state when invite anchor is present", () => {
		const state: ConnectionState = detectConnectionState({ ...baseSignals, has_invite_anchor: true });
		expect(state).toBe("connectable");
	});

	test("detects already_connected state when compose anchor exists without labeled action button", () => {
		const state: ConnectionState = detectConnectionState({
			...baseSignals,
			has_compose_anchor_in_action_root: true,
		});
		expect(state).toBe("already_connected");
	});

	test("detects follow_only state when compose anchor and labeled button coexist", () => {
		const state: ConnectionState = detectConnectionState({
			...baseSignals,
			has_compose_anchor_in_action_root: true,
			has_labeled_action_button: true,
		});
		expect(state).toBe("follow_only");
	});

	test("detects self_profile when edit_intro anchor is present", () => {
		const state: ConnectionState = detectConnectionState({
			...baseSignals,
			has_edit_intro_anchor: true,
		});
		expect(state).toBe("self_profile");
	});

	test("detects incoming_request when incoming action row is present", () => {
		const state: ConnectionState = detectConnectionState({
			...baseSignals,
			has_incoming_action_row: true,
		});
		expect(state).toBe("incoming_request");
	});

	test("detects pending when labeled action anchor is present", () => {
		const state: ConnectionState = detectConnectionState({
			...baseSignals,
			has_labeled_action_anchor: true,
		});
		expect(state).toBe("pending");
	});

	test("detects unavailable when no matching action signals are found", () => {
		const state: ConnectionState = detectConnectionState(baseSignals);
		expect(state).toBe("unavailable");
	});
});
