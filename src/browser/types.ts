import type { AppConfig } from "../config.ts";

export interface BrowserManagerOptions {
	config: AppConfig;
}

export type BrowserState =
	| "uninitialized"
	| "booting"
	| "ready"
	| "authenticating"
	| "failed";

export interface ConnectionSignals {
	// URL-based signals (locale-independent)
	hasCustomInvite?: boolean;
	hasEditProfile?: boolean;
	hasComposeMessage?: boolean;
	// Attribute-presence signals
	hasAriaLabel?: boolean;
	hasAriaExpanded?: boolean;
	hasAriaDisabled?: boolean;
	// Computed states
	alreadyConnected?: boolean;
	pending?: boolean;
	incomingRequest?: boolean;
	connectable?: boolean;
	followOnly?: boolean;
	selfProfile?: boolean;
	unavailable?: boolean;
}
