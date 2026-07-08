import { raiseToolError } from "../errors/handler.ts";
import type { ToolDef } from "./types.ts";

export function loadFeedTools(): ToolDef[] {
  return [
    {
      name: "get_feed",
      description:
        "Get posts from the authenticated user's LinkedIn feed. " +
        "Posts are loaded in batches of ~5 as the page scrolls, so the actual count may slightly exceed the target.",
      inputSchema: {
        type: "object",
        properties: {
          num_posts: {
            type: "number",
            description: "Number of posts to fetch (1-50, default 10)",
            default: 10,
          },
        },
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
  ];
}
