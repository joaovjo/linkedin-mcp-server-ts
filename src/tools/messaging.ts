import { raiseToolError } from "../errors/handler.ts";
import type { ToolDef } from "./types.ts";

export function loadMessagingTools(): ToolDef[] {
  return [
    {
      name: "get_inbox",
      description: "List recent conversations from the LinkedIn messaging inbox",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of conversations to load (1-50, default 20)",
            default: 20,
          },
        },
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "get_conversation",
      description:
        "Read a specific messaging conversation. " +
        "Provide either linkedin_username or thread_id to identify the conversation.",
      inputSchema: {
        type: "object",
        properties: {
          linkedin_username: {
            type: "string",
            description: "LinkedIn username of the conversation participant",
          },
          thread_id: {
            type: "string",
            description: "LinkedIn messaging thread ID",
          },
          index: {
            type: "number",
            description:
              "0-based selector for which thread to open when the participant has multiple threads. Ignored when thread_id is provided.",
            default: 0,
          },
        },
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "search_conversations",
      description: "Search messages by keyword",
      inputSchema: {
        type: "object",
        properties: {
          keywords: {
            type: "string",
            description: "Search keywords to filter conversations",
          },
          limit: {
            type: "number",
            description:
              "Maximum number of search-result rows to enumerate (1-50, default 20)",
            default: 20,
          },
        },
        required: ["keywords"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "send_message",
      description:
        "Send a message to a LinkedIn user. " +
        "The recipient must be directly messageable from the profile page. " +
        "This is a write operation when confirm_send is True.",
      inputSchema: {
        type: "object",
        properties: {
          linkedin_username: {
            type: "string",
            description: "LinkedIn username of the recipient",
          },
          message: {
            type: "string",
            description: "The message text to send",
          },
          confirm_send: {
            type: "boolean",
            description: "Must be True to send the message",
          },
          profile_urn: {
            type: "string",
            description:
              "Optional profile URN (e.g. ACoAAB...) to construct the compose URL directly. " +
              "Obtain via get_person_profile.",
          },
        },
        required: ["linkedin_username", "message", "confirm_send"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
  ];
}
