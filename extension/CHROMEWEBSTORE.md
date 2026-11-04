# Chrome Web Store Listing — LinkedIn MCP Bridge

> Last Updated: 2026-11-04

## Store Listing

**Extension Name**
LinkedIn MCP Bridge

**Short Description**
Extract LinkedIn data from your authenticated browser session for the LinkedIn MCP server.

**Detailed Description**
LinkedIn MCP Bridge reads public profile, company, job, messaging, and feed data from LinkedIn pages you are already signed into and forwards it to a locally running LinkedIn MCP server. It runs only when you click Connect, and all data stays on your machine.

**Category**
Productivity

**Single Purpose**
Extract LinkedIn page data from an authenticated browser session for local use by the LinkedIn MCP server.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ⬜ Not created | |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| tabs | permissions | Required to identify the active LinkedIn tab and send extraction messages to its content script. |
| storage | permissions | Stores bridge URL and connection status locally. |
| alarms | permissions | Schedules reconnection attempts to the local bridge. |
| https://www.linkedin.com/* | host_permissions | Required to inject content scripts and read LinkedIn page DOM. |

## Privacy & Data Use

**Does the extension collect user data?** No (data is processed locally and never transmitted off-device).

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
To be provided before submission.

## Distribution

**Visibility**: Unlisted
**Regions**: All regions

## Developer Info

**Publisher Name**
LinkedIn MCP Bridge

**Contact Email**
To be provided before submission.

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-11-04 | Initial scaffold | Draft |

## Review Notes

### Known Issues / Limitations

- Icons not yet created; manifest omits icon references.
- Content script selectors depend on LinkedIn DOM and may need updates.