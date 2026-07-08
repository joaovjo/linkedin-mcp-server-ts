import { loadCompanyTools } from "./company.ts";
import { loadFeedTools } from "./feed.ts";
import { loadJobTools } from "./job.ts";
import { loadMessagingTools } from "./messaging.ts";
import { loadPersonTools } from "./person.ts";
import type { ToolDef } from "./types.ts";

export function loadAllTools(): ToolDef[] {
	return [
		...loadPersonTools(),
		...loadCompanyTools(),
		...loadJobTools(),
		...loadMessagingTools(),
		...loadFeedTools(),
	];
}

export type { ToolDef } from "./types.ts";
