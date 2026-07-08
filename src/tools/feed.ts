import { browserManager } from "../browser/manager.ts";
import { raiseToolError } from "../errors/handler.ts";
import {
	checkLoginState,
	getMainInnerText,
	scrollFeed,
} from "../scraping/extractor.ts";
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
			handler: async (args) => {
				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				const numPosts = Math.min(
					Math.max((args.num_posts as number) || 10, 1),
					50,
				);
				const scrollsNeeded = Math.ceil(numPosts / 5);

				await browserManager.navigate("https://www.linkedin.com/feed/");

				for (let i = 0; i < scrollsNeeded; i++) {
					await scrollFeed();
					await Bun.sleep(2000);
				}

				const text = await getMainInnerText();
				return { content: [{ type: "text", text }] };
			},
		},
	];
}
