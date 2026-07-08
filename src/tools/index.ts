import type { ToolDef } from "./types.ts";
import { loadPersonTools } from "./person.ts";
import { loadCompanyTools } from "./company.ts";
import { loadJobTools } from "./job.ts";
import { loadMessagingTools } from "./messaging.ts";
import { loadFeedTools } from "./feed.ts";

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
