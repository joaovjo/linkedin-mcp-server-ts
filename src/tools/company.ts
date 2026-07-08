import { raiseToolError } from "../errors/handler.ts";
import type { ToolDef } from "./types.ts";

export function loadCompanyTools(): ToolDef[] {
  return [
    {
      name: "get_company_profile",
      description:
        "Get a specific company's LinkedIn profile. " +
        "Includes unknown_sections list when unrecognised names are passed. " +
        "When the about section is included, references[\"about\"] may include a company_urn entry.",
      inputSchema: {
        type: "object",
        properties: {
          company_name: {
            type: "string",
            description: 'LinkedIn company name (e.g., "docker", "anthropic", "microsoft")',
          },
          sections: {
            type: "string",
            description:
              "Comma-separated list of extra sections to scrape. " +
              "The about page is always included. " +
              'Available sections: posts, jobs. Examples: "posts", "posts,jobs"',
          },
        },
        required: ["company_name"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "get_company_posts",
      description: "Get recent posts from a company's LinkedIn feed",
      inputSchema: {
        type: "object",
        properties: {
          company_name: {
            type: "string",
            description: 'LinkedIn company name (e.g., "docker", "anthropic", "microsoft")',
          },
        },
        required: ["company_name"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "search_companies",
      description: "Search for companies on LinkedIn",
      inputSchema: {
        type: "object",
        properties: {
          keywords: {
            type: "string",
            description: 'Search keywords (e.g., "fintech", "anthropic", "electric vehicles")',
          },
        },
        required: ["keywords"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "get_company_employees",
      description:
        "List employees at a company from the LinkedIn /people/ page, including " +
        "the demographics aggregate: where employees live, where they studied, " +
        "and a function breakdown (Engineering, Sales, Operations, etc.). " +
        "company_name must be the exact LinkedIn URL slug, not the display name.",
      inputSchema: {
        type: "object",
        properties: {
          company_name: {
            type: "string",
            description:
              'LinkedIn company URL slug (e.g., "docker", "anthropicresearch", "microsoft")',
          },
          keywords: {
            type: "string",
            description: 'Optional filter by name, job title, or skill (e.g., "engineer", "sales")',
          },
        },
        required: ["company_name"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
  ];
}
