# LinkedIn MCP Server - TypeScript 6.x & Bun Refactoring Brief

## 1. Project Overview
A Model Context Protocol (MCP) server that provides scraping tools for LinkedIn data collection and automation. The server uses TypeScript with Bun runtime instead of Node.js and leverages Bun's WebView capabilities instead of Playwright for browser interaction.

## 2. Concept / Product Description
The LinkedIn MCP server enables clients to access LinkedIn data through standardized tools. It provides profile scraping, feed fetching, job searching, and messaging capabilities through the MCP protocol. This refactoring modernizes the tech stack to TypeScript 6.x and uses Bun's WebView for improved performance and simpler browser integration.

## 3. Tech Stack
- **Runtime**: Bun 1.x (JavaScript/TypeScript runtime)
- **Language**: TypeScript 6.x 
- **Browser Automation**: Bun WebView (replacing Playwright)
- **Package Manager**: Bun
- **Linter/Formatter**: Biome
- **Testing**: Built-in Bun testing framework
- **Build System**: Bun scripts

## 4. Architecture
The system consists of:
- Core Server (`server.ts`) - MCP server implementation
- Browser Manager (`browser/manager.ts`) - Manages WebView lifecycle and navigation
- Tools Module (`src/tools/`) - Individual scraping tools (person, company, feed, job, messaging)
- Configuration System (`config.ts`) - Configuration management
- Error Handling (`errors/`) - Custom error types and handling

Each tool implements MCP-compatible request handlers that interface with LinkedIn through WebView sessions.

## 5. Key Files Map
```
/src/index.ts           - Entry point for MCP server
/src/server.ts          - MCP server implementation
/src/browser/
  /manager.ts           - WebView manager class
  /types.ts             - BrowserState type definitions
/src/config.ts          - Configuration interface
/src/errors/
  /handler.ts           - Error handling utilities
  /types.ts             - Custom error type definitions
/src/tools/
  index.ts              - Tool loading and export
  person.ts             - Person profile scraping tools
  company.ts              - Company scraping tools
  feed.ts               - Feed/post scraping tools  
  job.ts                - Job search tools
  messaging.ts          - Messaging tools
  types.ts              - Tool definition types
```

## 6. Team Roles
- **Remy (Producer)**: Orchestrates sprint planning, refactoring tasks, PR reviews
- **Nova (Frontend Engineer)**: Handles WebView integration and UI aspects  
- **Sage (Backend Engineer)**: Maintains server logic and tool integration
- **Dash (DevOps Engineer)**: Manages build scripts and deployment pipelines
- **Ivy (QA Engineer)**: Tests the WebView functionality and signs off functionality

## 7. Sprint Status
- **Current Sprint**: Migration from Playwright to Bun WebView
- **Planned Duration**: 2 weeks
- **Key Milestones**: 
  - Week 1: Project prep, dependency updates, browser manager refactor
  - Week 2: Tool integration testing, bug fixing, performance validation

## 8. Current State
The project is currently using TypeScript with a WebView abstraction layer. However, it still uses Playwright-like patterns and dependencies. The refactoring will modernize the project to leverage Bun's WebView capabilities fully while upgrading to TypeScript 6.0 features.

## 9. Security Rules
- No sensitive data should be logged or exposed
- Browser sessions should be properly isolated
- Configuration secrets should not be committed to source control
- All external requests must validate responses before processing

## 10. How to Run Locally
1. Install dependencies: `npm install` or `bun install`
2. Start the server: `bun dev`
3. Run tests: `bun test`
4. Lint code: `bun lint`

## 11. How to Deploy
1. Build the project: `bun run build` (if build process exists)
2. Start production server: `bun start`
3. Configure environment variables as needed
4. Monitor logs for deployment status

## 12. Cross-Chat Handoff Protocol
- All architectural decisions documented in PROJECT_BRIEF.md
- Sprint status updates stored in `/docs/sprint-N/progress.md`
- Technical decisions recorded in separate status files
- Use `compress` tool to summarize completed phases
- Maintain backward compatibility with existing MCP interfaces

## 13. Bug & Fix Tracking
- All bugs filed as GitHub issues in appropriate repositories
- Issue numbers referenced in commit messages: "fix(#123)"
- QA team signs off functionality before merging
- Bug tracking maintained separately from codebase

## 14. Multi-Repo Setup
- Separate git clones for dev, qa, and devops contexts
- Feature branches created per sprint: `feature/sprint-N`
- PRs created for all major changes
- Merge only after QA sign-off and CI success

This brief should be updated at the start of each sprint and referenced during all team interactions.
</content>