import { raiseToolError } from "../errors/handler.ts";
import type { ToolDef } from "./types.ts";

export function loadPersonTools(): ToolDef[] {
  return [
    {
      name: "get_person_profile",
      description: "Get a specific person's LinkedIn profile",
      inputSchema: {
        type: "object",
        properties: {
          linkedin_username: {
            type: "string",
            description: 'LinkedIn username (e.g., "stickerdaniel", "williamhgates")',
          },
          sections: {
            type: "string",
            description:
              "Comma-separated list of extra sections to scrape. " +
              "The main profile page is always included. " +
              "Available sections: experience, education, interests, honors, languages, certifications, skills, projects, contact_info, posts. " +
              'Examples: "experience,education", "contact_info", "skills,projects", "posts"',
          },
          max_scrolls: {
            type: "number",
            description:
              "Maximum pagination attempts per section (1-50). " +
              "Default (None) uses 5 for detail sections and 10 for posts.",
          },
        },
        required: ["linkedin_username"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "search_people",
      description: "Search for people on LinkedIn",
      inputSchema: {
        type: "object",
        properties: {
          keywords: {
            type: "string",
            description: 'Search keywords (e.g., "software engineer", "recruiter at Google")',
          },
          location: {
            type: "string",
            description: 'Optional location filter (e.g., "New York", "Remote")',
          },
          network: {
            type: "array",
            items: { type: "string", enum: ["F", "S", "O"] },
            description:
              'Optional connection-degree filter. Each element is one of "F" (1st-degree), "S" (2nd-degree), "O" (3rd-degree and beyond). Example: ["F"] to only return 1st-degree connections.',
          },
          current_company: {
            type: "string",
            description:
              "Optional current-employer filter. Use the numeric company URN id (e.g. '1115' for SAP). " +
              "Look up a company's URN via get_company_profile.",
          },
        },
        required: ["keywords"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "connect_with_person",
      description:
        "Send a LinkedIn connection request or accept an incoming one. " +
        "The tool is annotated with destructiveHint so MCP clients will prompt for user confirmation before execution.",
      inputSchema: {
        type: "object",
        properties: {
          linkedin_username: {
            type: "string",
            description: 'LinkedIn username (e.g., "stickerdaniel", "williamhgates")',
          },
          note: {
            type: "string",
            description: "Optional note to include with the invitation",
          },
        },
        required: ["linkedin_username"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "get_sidebar_profiles",
      description:
        "Get profile links from sidebar recommendation sections on a LinkedIn profile page. " +
        'Extracts profiles from "More profiles for you", "Explore premium profiles", and "People you may know" sidebar sections.',
      inputSchema: {
        type: "object",
        properties: {
          linkedin_username: {
            type: "string",
            description: 'LinkedIn username of the profile page to scrape (e.g., "stickerdaniel", "williamhgates")',
          },
        },
        required: ["linkedin_username"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "get_my_profile",
      description:
        "Get the authenticated user's own LinkedIn profile. " +
        "Navigates to /in/me/ and resolves the redirect to obtain the real username before scraping.",
      inputSchema: {
        type: "object",
        properties: {
          sections: {
            type: "string",
            description:
              "Comma-separated list of extra sections to scrape. " +
              "The main profile page is always included. " +
              "Available sections: experience, education, interests, honors, languages, certifications, skills, projects, contact_info, posts. " +
              'Examples: "experience,education", "contact_info", "skills,projects"',
          },
          max_scrolls: {
            type: "number",
            description: "Maximum pagination attempts per section (1-50).",
          },
        },
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
  ];
}
