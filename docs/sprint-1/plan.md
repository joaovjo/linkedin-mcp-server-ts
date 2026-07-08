# Sprint 1: TypeScript 6.x & Bun WebView Migration

## Goal
Port the LinkedIn MCP Server from Python/Playwright to TypeScript 6.x/Bun.WebView

## Tasks

### Core Infrastructure (Done)
- [x] Create project structure with TypeScript 6.x + Bun
- [x] Configure tsconfig for TS6 features (verbatimModuleSyntax, ESNext target)
- [x] Set up package.json with bun scripts, Biome for linting
- [x] Implement Bun.WebView BrowserManager (headless browser wrapper)
- [x] Add scraping helper methods (waitForSelector, getTextContent, getAllTexts, evaluate, click, type, press, scroll)
- [x] Create error handling infrastructure (typed error classes)
- [x] Implement config system with env/CLI arg parsing
- [x] Set up MCP server with streamable-http transport
- [x] Add login utility with session persistence

### Tool Implementations (Done)
- [x] Person profile scraping (get_person_profile, search_people, connect_with_person, get_sidebar_profiles, get_my_profile)
- [x] Company scraping (get_company_profile, get_company_posts, search_companies, get_company_employees)
- [x] Feed scraping (get_feed with scroll-based loading)
- [x] Job scraping (get_job_details, search_jobs with filter params)
- [x] Messaging (get_inbox, get_conversation, search_conversations, send_message)

### Scraping Infrastructure (Done)
- [x] Section definitions (PERSON_SECTIONS, COMPANY_SECTIONS)
- [x] LinkedIn noise stripping (footer, sidebar, media controls)
- [x] Auth state checking
- [x] Rate limit detection

## Success Criteria
- [x] TypeScript compilation passes (bun x tsc --noEmit)
- [x] Biome lint passes (only 3 explicit-any warnings from WebView types)
- [x] Server starts and responds to MCP initialize
- [x] Health endpoint returns OK
- [x] Tools list endpoint returns all registered tools
