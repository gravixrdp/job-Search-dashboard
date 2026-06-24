# gravix-job - Job Dashboard Project Memory

## Project Overview
**gravix-job** is a job search command center built as a full-stack application on Cloudflare. It automates job searching across multiple platforms and performs social listening on LinkedIn to find hiring posts from recruiters. The app provides a unified dashboard for managing job applications and tracking hiring opportunities.

## Recent Changes (2026-06-25)
- Changed logo name from HuntSync AI to gravix-job (src/App.tsx)
- Increased scraper result limits:
  - Indeed: maxItemsPerSearch from 100 to 150
  - All others: maxPagesPerQuery from 2 to 3
- Reverted LinkedIn actor ID to curious_coder/linkedin-jobs-scraper due to compatibility issues
- Updated token update UI in config-tab.tsx to clarify current token is stored securely
- Optimized scrapers to combine multiple keywords/locations into single requests (avoids Cloudflare subrequest limits)

**Repository**: `d:\job-dashboard\job-Search-dashboard`

## Technology Stack
- **Frontend**: React 19 + TypeScript + Vite 7
- **UI Framework**: Radix UI + Tailwind CSS 4 + shadcn/ui components
- **Backend**: Cloudflare Worker (full-stack, serves both API and SPA)
- **Database**: Cloudflare D1 (SQLite-based, primary storage)
- **Backup**: Google Sheets API (dual-write for jobs and posts)
- **Scraper Integration**: Apify API (10 different job board scrapers)
- **Deployment**: Cloudflare Workers via Wrangler
- **Build Tool**: Vite with React plugin
- **Form Handling**: React Hook Form + Zod validation

## Architecture

### Frontend Structure (`src/`)
```
src/
├── App.tsx                    # Main app with 3 tabs: Jobs, Social, Config
├── components/
│   ├── dashboard/
│   │   ├── job-search-tab.tsx      # Job scraping, filtering, results table
│   │   ├── social-listening-tab.tsx # LinkedIn post scraping, query builder
│   │   └── config-tab.tsx          # Apify/GCP config, connection testing
│   └── ui/                         # shadcn/ui component library (40+ components)
├── services/
│   ├── apify.ts              # Apify scraper integration (10 platforms)
│   ├── google-sheets.ts      # Data operations (via Worker API)
│   └── config.ts             # Configuration management (D1-backed)
├── types/
│   └── index.ts              # All TypeScript interfaces
└── hooks/
    └── use-mobile.ts         # Responsive breakpoint hook
```

### Backend Structure (`worker/index.ts`)
Single Cloudflare Worker file (637 lines) that:
- Serves React SPA static assets via `env.ASSETS`
- Handles all API routes under `/api/*`
- Manages D1 database operations
- Proxies Apify scraper requests with polling
- Implements Google Sheets backup sync
- Manages JWT-based Google OAuth (RS256 via Web Crypto)
- Syncs secrets to Cloudflare Worker Secrets API

## Key Features

### 1. Job Search Tab
**Purpose**: Automated multi-platform job scraping and application tracking

**Core Functionality**:
- **Filter Builder**: Keywords, locations, experience level (0-1, 1-3, 3-5, 5+ years, Internship), job types (Remote, WFO, WFH)
- **Multi-Platform Scraping**: LinkedIn, Indeed, Naukri, Glassdoor, Internshala, Wellfound, Foundit, Hirist, Shine
- **Saved Filters**: Persisted to localStorage for reuse
- **Results Table**: Sortable, filterable table with status management (To Apply → Applied → Interviewing → Rejected)
- **Client-Side Filtering**: Location and job type filters applied after scraping
- **Deduplication**: Job IDs generated from platform+title+company+location hash

**Data Flow**:
1. User configures filters (keywords, locations, etc.)
2. Clicks "Scrape [Platform]" button
3. Frontend calls `/api/apify/run` with actor ID and input
4. Worker starts Apify run, polls for completion (max 120s)
5. Fetches dataset items from Apify
6. Transforms items to `Job` type with normalized fields
7. Appends to D1 via `/api/jobs/append` (deduplicates against existing)
8. Backs up to Google Sheets (`All_Jobs_Master` sheet)
9. Reloads job list for display

### 2. Social Listening Tab
**Purpose**: Find hiring posts from recruiters/founders on LinkedIn

**Core Functionality**:
- **Boolean Query Builder**: Compose complex search queries with AND/OR/NOT operators
- **Quick Presets**: Pre-built queries for DevOps, Tech Remote, Platform Engineer
- **Location/Date Filtering**: Client-side filters on post text and scrape date
- **Post Feed Card UI**: Shows author, title, post text, email, experience requirements
- **Keyword Highlighting**: Automatically detects and highlights tech keywords (DevOps, Cloud, Kubernetes, AWS, etc.)
- **Status Tracking**: Unread → Contacted → Ignored

**Data Extraction**:
- Email addresses extracted via regex from post text
- Experience requirements parsed (e.g., "3+ years", "5 years of experience")
- Tech keywords detected from predefined list
- Posts auto-filtered to last 7 days

**Data Flow**:
1. User composes boolean search query or selects preset
2. Clicks "Start Social Scraper"
3. Worker calls Apify `harvestapi/linkedin-post-search` actor
4. Transforms results to `LinkedInHiringPost` with extracted data
5. Appends to D1 via `/api/posts/append`
6. Backs up to Google Sheets (`LinkedIn_Hiring_Posts` sheet)
7. Displays in card-based feed UI

### 3. Configuration Tab
**Purpose**: Manage API integrations and system settings

**Apify Configuration**:
- **API Token Management**: Save/remove token with dual storage (D1 + Cloudflare Secrets)
  - D1 storage: Immediate availability, primary source
  - CF Secrets sync: Best-effort via Cloudflare API, requires `CF_API_TOKEN`
  - Token retrieval: D1 takes priority, falls back to env variable
- **Actor ID Mapping**: 10 configurable actor IDs for different platforms
  - Default actors hardcoded in worker (e.g., `curious_coder/linkedin-jobs-scraper`)
  - Custom actors saved to D1 `config` table as JSON
- **Connection Testing**: POST `/api/apify/test` validates token via `/v2/users/me`

**GCP Configuration**:
- **Service Account Key**: JSON key for Google Sheets API access
- **Spreadsheet ID**: ID of Google Sheet with `All_Jobs_Master` and `LinkedIn_Hiring_Posts` sheets
- **Connection Testing**: POST `/api/config/test-gcp` validates access to spreadsheet
- **JWT Auth**: RS256 signed JWT via Web Crypto, cached with expiry management

**Control Center**:
- **Wipe Database**: Clears D1 tables + Google Sheets data
- **Clear All Config**: Removes all API keys and settings from D1

## Data Models

### D1 Database Schema (4 tables)
```sql
jobs (job_id PK, source_platform, title, company, location, job_type, experience_req, url, date_posted, scraped_at, application_status)
linkedin_posts (post_id PK, author_name, author_title, post_text, post_url, email, experience_req, detected_keywords, scraped_at, status)
config (key PK, value, updated_at)  -- Stores: apify_token, apify_actor_ids, gcp_service_account_key, gcp_spreadsheet_id
filters (id PK, name, data JSON, created_at, updated_at)
```

### Key TypeScript Types
```typescript
Job: { job_id, source_platform (9 platforms), title, company, location, job_type (Remote/WFO/WFH), experience_req, url, date_posted, scraped_at, application_status (4 statuses) }

LinkedInHiringPost: { post_id, author_name, author_title, post_text, post_url, email, experience_req, detected_keywords, status (Unread/Contacted/Ignored), scraped_at }

SearchFilter: { id, name, keywords[], experience, locations[], job_types[], created_at, updated_at }

ApifyConfig: { apiToken, hasToken, canManageSecrets, [10 actor IDs] }
GCPConfig: { serviceAccountKey, spreadsheetId }
```

## API Routes (Worker)

### Apify Routes
- `POST /api/apify/test` - Test token validity
- `POST /api/apify/run` - Run scraper (actorId + input)
- `PUT /api/apify/token` - Save token to D1 + sync to CF secret
- `DELETE /api/apify/token` - Remove token from D1 + CF secret

### Jobs Routes
- `GET /api/jobs` - Fetch all jobs (ordered by scraped_at DESC)
- `POST /api/jobs/append` - Add new jobs (deduplication + Sheets backup)
- `PATCH /api/jobs/status` - Update application_status + sync to Sheets

### Posts Routes
- `GET /api/posts` - Fetch all LinkedIn posts (ordered by rowid DESC)
- `POST /api/posts/append` - Add new posts (deduplication + Sheets backup)
- `PATCH /api/posts/status` - Update post status + sync to Sheets

### Config Routes
- `GET /api/config` - Get full config (merged with defaults, token masked)
- `PUT /api/config` - Save Apify actor IDs + GCP settings
- `POST /api/config/test-gcp` - Test Google Sheets access

### Filters Routes
- `GET /api/filters` - Fetch saved filters
- `POST /api/filters` - Create/update filter (upsert by id)
- `DELETE /api/filters/:id` - Delete filter

### Utility Routes
- `POST /api/wipe` - Clear all jobs + posts from D1 + Sheets

## Google Sheets Integration

### Authentication Flow
1. Parse service account JSON key
2. Create JWT payload with `https://www.googleapis.com/auth/spreadsheets` scope
3. Sign JWT using RS256 via Web Crypto (`crypto.subtle`)
4. Exchange JWT for access token at `https://oauth2.googleapis.com/token`
5. Cache token with expiry (refresh 60s before expiration)
6. Use token in `Authorization: Bearer` header for Sheets API calls

### Backup Operations
- **Jobs Backup**: Append to `All_Jobs_Master!A:K` (11 columns)
- **Posts Backup**: Append to `LinkedIn_Hiring_Posts!A:J` (10 columns)
- **Status Sync**: Update specific cell (e.g., `K{rowIndex}` for job status)
- **Wipe**: Clear `A2:K` and `A2:J` ranges (preserve headers)

### Sheet Requirements
- Must have two sheets: `All_Jobs_Master` and `LinkedIn_Hiring_Posts`
- Service account email must have editor access
- Headers in row 1, data starts from row 2

## Apify Integration

### Scraper Execution Pattern
```
1. POST /v2/acts/{actorId}/runs?waitForFinish=0  (non-blocking start)
2. Poll /v2/acts/{actorId}/runs/{runId} every 2s (max 60 attempts = 120s)
3. Break when status: SUCCEEDED/ABORTED/FAILED/TIMED-OUT
4. GET /v2/datasets/{datasetId}/items  (fetch results)
5. Return items to frontend
```

### Supported Platforms (9 job boards + 1 post scraper)
- LinkedIn Jobs: `curious_coder/linkedin-jobs-scraper` (uses urls)
- Indeed: `misceres/indeed-scraper` (uses position + location, maxItemsPerSearch: 150)
- Naukri: `accurate_workstation/naukri-jobs-scraper-free` (maxPagesPerQuery: 3)
- Glassdoor: `fatihai-tools/glassdoor-jobs` (maxPagesPerQuery: 3)
- Internshala: `unfenced-group/internshala-scraper` (maxPagesPerQuery: 3)
- Wellfound: `blackfalcondata/wellfound-scraper` (maxPagesPerQuery: 3)
- Foundit: `codingfrontend/foundit-jobs-scraper` (maxPagesPerQuery: 3)
- Hirist: `logiover/hirist-tech-scraper` (maxPagesPerQuery: 3)
- Shine: `unfenced-group/shine-scraper` (maxPagesPerQuery: 3)
- LinkedIn Posts: `harvestapi/linkedin-post-search` (boolean queries)

### Data Normalization
Each platform-specific scraper normalizes output to common `ApifyDatasetItem` format:
```typescript
{ title, company, location, url, date, type, description, salary }
```
Then transformed to domain types with ID generation and field extraction.

## Configuration Management

### Storage Strategy
- **Primary**: D1 `config` table (key-value pairs)
- **Cache**: Frontend memory (`cachedConfig` in config.ts)
- **Defaults**: Hardcoded in frontend (`defaultApifyConfig`, `defaultGCPConfig`)
- **Secrets**: Cloudflare Worker Secrets (APIFY_TOKEN, CF_API_TOKEN, GCP_SERVICE_ACCOUNT_KEY, GCP_SPREADSHEET_ID)

### Config Keys in D1
- `apify_token` - Apify API token
- `apify_actor_ids` - JSON object mapping platform names to actor IDs
- `gcp_service_account_key` - GCP service account JSON key
- `gcp_spreadsheet_id` - Google Sheets spreadsheet ID

### Secret Sync Flow
When user saves Apify token via UI:
1. Save to D1 `config` table (immediate, always succeeds)
2. Sync to Cloudflare Worker secret via CF API (best-effort)
   - Requires `CF_API_TOKEN` and `CF_ACCOUNT_ID` env vars
   - PUT to `/client/v4/accounts/{id}/workers/scripts/{name}/secrets`
3. Return sync status to UI (D1 ✓, CF Secret ✓/✗)

Token retrieval prioritizes D1 over env secret for consistency.

## Important Business Logic

### Deduplication
- **Jobs**: `job_id` = base64(platform-title-company-location) first 32 chars
- **Posts**: `post_id` = Apify item.id or base64(author-postUrl) first 32 chars
- Append operations check existing IDs before insert (`INSERT OR IGNORE`)

### Status Management
- Jobs: To Apply → Applied → Interviewing → Rejected
- Posts: Unread → Contacted → Ignored
- Status changes sync to both D1 and Google Sheets (non-blocking for Sheets)

### Filter Application
- **Server-Side**: None (all scraping uses full filter params)
- **Client-Side**: Location and job type filters applied to results after scraping
- **Saved Filters**: Stored in localStorage (not synced to server)

### Error Handling
- Apify scraper failures: Caught per-platform, continues to next platform
- Sheets backup failures: Logged but non-critical (doesn't block main flow)
- Secret sync failures: Reported to UI but D1 save still succeeds
- All API errors return `{ error: string }` with appropriate HTTP status

## Deployment & Environment

### Wrangler Configuration
```toml
name = "huntsync-ai"
main = "worker/index.ts"
compatibility_date = "2025-06-18"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"

[[d1_databases]]
binding = "DB"
database_name = "huntsync-db"
database_id = "c7e5e19d-71c1-4df6-acee-c9e6a31ff03d"

[vars]
CF_ACCOUNT_ID = "2fd4826d0cab77104d075279de4397f1"
```

### Required Secrets (set via `wrangler secret put`)
- `APIFY_TOKEN` - Apify API token
- `CF_API_TOKEN` - Cloudflare API token (for secret management)
- `GCP_SERVICE_ACCOUNT_KEY` - GCP service account JSON
- `GCP_SPREADSHEET_ID` - Google Sheets ID

### Build & Deploy Commands
```bash
npm run dev           # Start Vite dev server
npm run dev:worker    # Start Wrangler local dev
npm run build         # Build for production
npm run deploy        # Build + deploy to Cloudflare
```

## Key Implementation Details

### Google Sheets JWT Auth (Server-Side)
- Uses Web Crypto API (`crypto.subtle`) for RS256 signing
- No external JWT library (reduces bundle size)
- Token cached in worker memory with expiry tracking
- Refreshes 60 seconds before expiration

### CORS Handling
- Worker handles OPTIONS preflight requests
- Allows all origins (`Access-Control-Allow-Origin: *`)
- Supports GET, POST, PATCH, DELETE, OPTIONS methods

### Timeout Management
- Apify scraper calls: 3-minute timeout via `AbortController`
- Polling loop: Max 60 attempts × 2s = 120 seconds
- Frontend shows loading states during all async operations

### Data Transformation
- Email extraction: Regex `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/`
- Experience extraction: Patterns for "N years", "N-M years", level keywords
- Keyword detection: Predefined list (DevOps, Cloud, Kubernetes, AWS, GCP, Azure, SRE, Platform Engineer)
- Job type determination: "remote" → Remote, "hybrid"/"wfh" → WFH, else → WFO

## Common Development Tasks

### Adding New Scraper Platform
1. Add actor ID to `DEFAULT_ACTOR_IDS` in worker
2. Add to `ApifyConfig` type and `defaultApifyConfig` in config.ts
3. Create `run[Platform]Scraper` function in apify.ts
4. Add platform to `SourcePlatform` union type
5. Add platform colors in job-search-tab.tsx
6. Add UI button in job-search-tab.tsx

### Modifying Database Schema
1. Update `schema.sql` with new table/column
2. Create migration (D1 doesn't auto-migrate)
3. Apply via `wrangler d1 execute huntsync-db --file=schema.sql`
4. Update TypeScript types in types/index.ts
5. Update worker route handlers for new fields

### Testing API Routes
Use wrangler dev environment:
```bash
npm run dev:worker
# Test with curl or browser
curl http://localhost:8787/api/jobs
curl -X POST http://localhost:8787/api/apify/test
```

## Critical Paths & Gotchas

1. **Apify Token Priority**: D1 > env secret. Always check D1 first in `getApifyToken()`
2. **Sheets Backup Failures**: Wrapped in try-catch, never block main flow
3. **Secret Sync**: Requires CF_API_TOKEN, fails silently if not configured
4. **D1 Batch Operations**: Uses `env.DB.batch()` for efficient multi-insert
5. **SPA Routing**: `not_found_handling = "single-page-application"` in wrangler.toml
6. **CORS**: Handled in worker, not needed for same-origin frontend calls
7. **Token Masking**: Config endpoint returns `"***"` for apiToken, not actual value
8. **Filter Storage**: Saved filters in localStorage only, not synced to server
9. **Date Filtering**: Client-side only, based on `scraped_at` timestamp
10. **Deduplication**: `INSERT OR IGNORE` prevents duplicate job_id/post_id

## Quick Reference

### File Locations
- Main App: `src/App.tsx`
- Job Search: `src/components/dashboard/job-search-tab.tsx`
- Social Listening: `src/components/dashboard/social-listening-tab.tsx`
- Configuration: `src/components/dashboard/config-tab.tsx`
- Worker API: `worker/index.ts`
- Database Schema: `schema.sql`
- Types: `src/types/index.ts`
- Services: `src/services/{apify,google-sheets,config}.ts`

### Key Constants
- Default keywords: DevOps Engineer, Cloud Engineer, SRE, Platform Engineer, Infrastructure Engineer
- Default locations: Ahmedabad, Gandhinagar, Rajkot, Surat, Jamnagar, Vadodara, Pune, Bangalore, Mumbai, Remote
- Scraper timeout: 180 seconds (3 minutes)
- Apify poll interval: 2 seconds, max 60 attempts
- Token cache expiry: 60 seconds before actual expiration

### External Dependencies
- Apify: Job scraping from 9 platforms + LinkedIn posts
- Google Sheets: Backup storage and collaboration
- Cloudflare D1: Primary database
- Cloudflare Workers: Serverless compute + asset hosting
- Cloudflare Secrets: Secure credential storage
