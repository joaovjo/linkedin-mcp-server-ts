import { raiseToolError } from "../errors/handler.ts";
import type { ToolDef } from "./types.ts";

export function loadJobTools(): ToolDef[] {
  return [
    {
      name: "get_job_details",
      description: "Get job details for a specific job posting on LinkedIn",
      inputSchema: {
        type: "object",
        properties: {
          job_id: {
            type: "string",
            description: 'LinkedIn job ID (e.g., "4252026496", "3856789012")',
          },
        },
        required: ["job_id"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
    {
      name: "search_jobs",
      description:
        "Search for jobs on LinkedIn. " +
        "Returns job_ids that can be passed to get_job_details for full info.",
      inputSchema: {
        type: "object",
        properties: {
          keywords: {
            type: "string",
            description: 'Search keywords (e.g., "software engineer", "data scientist")',
          },
          location: {
            type: "string",
            description: 'Optional location filter (e.g., "San Francisco", "Remote")',
          },
          max_pages: {
            type: "number",
            description: "Maximum number of result pages to load (1-10, default 3)",
            default: 3,
          },
          date_posted: {
            type: "string",
            description:
              "Filter by posting date (past_hour, past_24_hours, past_week, past_month)",
          },
          job_type: {
            type: "string",
            description:
              "Filter by job type, comma-separated (full_time, part_time, contract, temporary, volunteer, internship, other)",
          },
          experience_level: {
            type: "string",
            description:
              "Filter by experience level, comma-separated (internship, entry, associate, mid_senior, director, executive)",
          },
          work_type: {
            type: "string",
            description:
              "Filter by work type, comma-separated (on_site, remote, hybrid)",
          },
          easy_apply: {
            type: "boolean",
            description: "Only show Easy Apply jobs (default false)",
            default: false,
          },
          sort_by: {
            type: "string",
            description: "Sort results (date, relevance)",
          },
        },
        required: ["keywords"],
      },
      handler: async () => {
        return raiseToolError(new Error("Not implemented (Sprint 1+)"));
      },
    },
  ];
}
