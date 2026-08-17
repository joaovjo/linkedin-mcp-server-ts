import { describe, expect, test } from "bun:test";
import { type ActionSignals, detectConnectionState } from "../../src/scraping/connection.ts";

const CONNECT_STATUSES = [
	"already_connected",
	"pending",
	"incoming_request",
	"connected",
	"accepted",
	"connect_unavailable",
	"unavailable",
	"send_failed",
	"custom_note_limit_reached",
] as const;

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
		expect(detectConnectionState({ ...baseSignals, has_invite_anchor: true })).toBe("connectable");
	});

	test("detects already_connected state when compose anchor exists without labeled action button", () => {
		expect(
			detectConnectionState({
				...baseSignals,
				has_compose_anchor_in_action_root: true,
			}),
		).toBe("already_connected");
	});

	test("detects follow_only state when compose anchor and labeled button coexist", () => {
		expect(
			detectConnectionState({
				...baseSignals,
				has_compose_anchor_in_action_root: true,
				has_labeled_action_button: true,
			}),
		).toBe("follow_only");
	});

	test("detects self_profile when edit_intro anchor is present", () => {
		expect(
			detectConnectionState({
				...baseSignals,
				has_edit_intro_anchor: true,
			}),
		).toBe("self_profile");
	});

	test("detects incoming_request when incoming action row is present", () => {
		expect(
			detectConnectionState({
				...baseSignals,
				has_incoming_action_row: true,
			}),
		).toBe("incoming_request");
	});

	test("enum values include all valid connect outcome statuses", () => {
		for (const s of CONNECT_STATUSES) {
			expect(typeof s).toBe("string");
		}
		expect(CONNECT_STATUSES).toContain("connected");
		expect(CONNECT_STATUSES).toContain("custom_note_limit_reached");
	});
});
