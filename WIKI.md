# HuntSync AI — Repository Wiki

> **Job Search Command Center** — A multi-platform job scraping and social listening dashboard that aggregates listings from 9+ job boards and monitors LinkedIn hiring posts, persisting all data to Google Sheets.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Architecture](#2-architecture)
- [3. Tech Stack](#3-tech-stack)
- [4. Directory Structure](#4-directory-structure)
- [5. Core Modules](#5-core-modules)
  - [5.1 App Shell (`App.tsx`)](#51-app-shell-apptsx)
  - [5.2 Job Search Tab](#52-job-search-tab)
  - [5.3 Social Listening Tab](#53-social-listening-tab)
  - [5.4 Configuration Tab](#54-configuration-tab)
- [6. Services Layer](#6-services-layer)
  - [6.1 Apify Service](#61-apify-service)
  - [6.2 Google Sheets Service](#62-google-sheets-service)
  - [6.3 Config Store](#63-config-store)
- [7. Type System](#7-type-system)
- [8. Data Flow](#8-data-flow)
- [9. Supported Platforms](#9-supported-platforms)
- [10. Google Sheets Schema](#10-google-sheets-schema)
- [11. Configuration & Environment](#11-configuration--environment)
- [12. Setup Guide](#12-setup-guide)
- [13. Development Commands](#13-development-commands)
- [14. UI Component Library](#14-ui-component-library)

---

## 1. Project Overview

**HuntSync AI** is a browser-based dashboard that automates job discovery across Indian and global job markets. It has two primary capabilities:

1. **Job Search** — Triggers web scrapers on 9 job platforms (LinkedIn, Indeed, Naukri, Glassdoor, Internshala, Wellfound, Foundit, Hirist, Shine) via Apify actors proxied through a Supabase Edge Function, then writes de-duplicated results to a Google Sheet.

2. **Social Listening** — Scrapes LinkedIn posts containing hiring signals using boolean search queries, extracts keywords, and stores them for outreach tracking.

All configuration (API tokens, actor IDs, GCP credentials) is stored in the browser's `localStorage`. There is **no backend server** — the app runs entirely client-side, calling the Supabase Edge Function and Google Sheets API directly.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (React SPA)                     │
│                                                              │
│  ┌──────────┐   ┌────────────────┐   ┌──────────────────┐  │
│  │ Job Search│   │Social Listening│   │  Configuration   │  │
│  │   Tab     │   │     Tab        │   │      Tab         │  │
│  └─────┬─────┘   └───────┬────────┘   └────────┬─────────┘  │
│        │                 │                      │            │
│  ┌─────┴─────────────────┴──────────────────────┴───────┐   │
│  │                  Services Layer                        │   │
│  │  ┌──────────┐  ┌────────────────┐  ┌──────────────┐  │   │
│  │  │  apify.ts│  │ google-sheets  │  │   config.ts   │  │   │
│  │  │          │  │     .ts        │  │ (localStorage)│  │   │
│  │  └────┬─────┘  └───────┬────────┘  └──────────────┘  │   │
│  └───────┼─────────────────┼────────────────────────────┘   │
└──────────┼─────────────────┼────────────────────────────────┘
           │                 │
           ▼                 ▼
  ┌─────────────────┐  ┌───────────────────┐
  │ Supabase Edge   │  │ Google Sheets API │
  │ Function        │  │ (OAuth2 JWT)      │
  │ (apify-proxy)   │  └───────────────────┘
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   Apify API     │
  │ (Actor runs +   │
  │  dataset fetch)  │
  └─────────────────┘
```

**Key architectural decisions:**
- **No custom backend** — Supabase Edge Function proxies all Apify calls to avoid CORS issues and keep the API token secure.
- **JWT-based Google auth** — The app signs JWTs in-browser using the Web Crypto API (RS256) to obtain OAuth2 access tokens for Google Sheets.
- **localStorage persistence** — All config, filters, and theme preferences survive page reloads without a database.

---

## 3. Tech Stack

| Layer              | Technology                          | Version  |
| ------------------ | ----------------------------------- | -------- |
| Framework          | React                               | ^19.2.4  |
| Build Tool         | Vite                                | ^7.3.1   |
| Language           | TypeScript                          | ~5.9.3   |
| Styling            | Tailwind CSS v4 (via Vite plugin)   | ^4.2.1   |
| UI Components      | shadcn/ui (Radix UI primitives)     | Radix ^1.4.3 |
| Icons              | lucide-react                        | ^1.6.0   |
| Form Handling      | react-hook-form + Zod               | ^7.72 / ^4.3 |
| Charts             | Recharts                            | ^3.8.0   |
| Theme              | Custom ThemeProvider (next-themes–style) | —    |
| Toasts             | Sonner                              | ^2.0.7   |
| Scraping Proxy     | Supabase Edge Function              | —        |
| Scraping Engine    | Apify Actors                        | client ^2.12.2 |
| Data Persistence   | Google Sheets API v4                | googleapis ^144 |
| Path Alias         | `@/*` → `./src/*`                  | —        |

---

## 4. Directory Structure

```
job-Search-dashboard/
├── public/
│   └── vite.svg                          # Favicon
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── job-search-tab.tsx        # Job scraping & results UI
│   │   │   ├── social-listening-tab.tsx  # LinkedIn post monitoring UI
│   │   │   └── config-tab.tsx           # API credentials & settings UI
│   │   ├── ui/                           # 50+ shadcn/ui components
│   │   ├── mode-toggle.tsx               # Light/dark/system theme switcher
│   │   └── theme-provider.tsx            # Theme context & persistence
│   ├── hooks/
│   │   └── use-mobile.ts                 # Responsive breakpoint hook
│   ├── lib/
│   │   └── utils.ts                      # cn() utility (clsx + tailwind-merge)
│   ├── services/
│   │   ├── apify.ts                      # Apify scraper orchestration (348 lines)
│   │   ├── config.ts                     # localStorage config store
│   │   └── google-sheets.ts              # Google Sheets CRUD + JWT auth (354 lines)
│   ├── types/
│   │   └── index.ts                      # All TypeScript interfaces & type aliases
│   ├── App.tsx                           # Root component with tab layout
│   ├── index.css                         # Tailwind v4 + OKLCH theme tokens
│   └── main.tsx                          # React entry point
├── .env                                  # Supabase URL + anon key
├── vite.config.ts                        # Vite + React + Tailwind + path alias
├── tsconfig.app.json                     # Strict TS config with @/* paths
└── package.json                          # Project metadata & dependencies
```

---

## 5. Core Modules

### 5.1 App Shell (`App.tsx`)

The root component renders a sticky header with the **HuntSync AI** branding and a theme toggle, followed by a 3-tab layout:

| Tab              | Component              | Icon             |
| ---------------- | ---------------------- | ---------------- |
| `jobs`           | `JobSearchTab`         | `Search`         |
| `social`         | `SocialListeningTab`   | `UserRoundSearch`|
| `config`         | `ConfigTab`            | `Settings`       |

State: `activeTab` (controlled via `useState`).

---

### 5.2 Job Search Tab

**File:** `src/components/dashboard/job-search-tab.tsx` (523 lines)

**Responsibilities:**
- **Filter Builder** — Manage keywords, locations, experience level, and job type selections
- **Scraper Triggering** — Run individual or all platform scrapers sequentially
- **Results Table** — Display scraped jobs with platform badge, title link, company, location, type, and status
- **Status Management** — Update application status (To Apply → Applied → Interviewing → Rejected)
- **Filter Persistence** — Save/load named filters to `localStorage` under key `huntsync_filters`

**Default filter presets:**
- Keywords: `DevOps Engineer`, `Cloud Engineer`, `SRE`, `Platform Engineer`, `Infrastructure Engineer`
- Locations: `Ahmedabad`, `Pune`, `Remote`, `Bangalore`, `Mumbai`

**State managed:**
- `filters` / `jobs` — loaded from localStorage / Google Sheets on mount
- `selectedKeywords` / `selectedLocations` / `selectedJobTypes` / `selectedExperience` — current filter criteria
- `isScraping` / `scrapingPlatform` — scraper progress tracking

---

### 5.3 Social Listening Tab

**File:** `src/components/dashboard/social-listening-tab.tsx` (276 lines)

**Responsibilities:**
- **Boolean Query Builder** — Textarea for constructing LinkedIn post search queries with AND/OR/NOT operators
- **Preset Queries** — Quick-apply templates (DevOps Hiring, Tech Remote, Platform Engineer)
- **Post Feed** — Card-based feed showing author, title, post text with highlighted keywords, and detected keyword badges
- **Status Tracking** — Mark posts as Unread / Contacted / Ignored

**Preset queries:**
```
DevOps Hiring:    ("hiring" OR "looking for") AND ("DevOps" OR "Cloud Engineer" OR "SRE")
Tech Remote:      ("hiring" OR "looking for") AND ("Tech" OR "Software") AND "Remote"
Platform Engineer:("hiring" OR "looking for") AND ("Platform Engineer" OR "Infrastructure")
```

---

### 5.4 Configuration Tab

**File:** `src/components/dashboard/config-tab.tsx` (502 lines)

**Responsibilities:**
- **Apify API Engine** — Token input (show/hide toggle), actor ID mapping for all 9 platforms + LinkedIn Post actor
- **GCP Security Engine** — Service Account JSON key textarea (blurred by default), Spreadsheet ID input
- **Connection Testing** — Test both Apify and GCP connections with status badges (Connected / Error / Not Tested)
- **Control Center** — Destructive actions: Wipe all spreadsheet data, Clear all local config
- **Setup Instructions** — Step-by-step onboarding guide

---

## 6. Services Layer

### 6.1 Apify Service

**File:** `src/services/apify.ts` (348 lines)

All scraping goes through a **Supabase Edge Function** at `https://wagohholwpjvfrxoefc.supabase.co/functions/v1/apify-proxy`.

**Core function:** `runScraperViaProxy(apiToken, actorId, input)` — POST to edge function with `{ actorId, input, apiToken, timeoutSecs: 300 }`.

**Platform-specific scrapers:**

| Function                   | Actor ID Default                          | Input Shape                              |
| -------------------------- | ----------------------------------------- | ---------------------------------------- |
| `runLinkedInScraper`       | `curious_coder/linkedin-jobs-scraper`     | `{ searchUrls, scrapeCompanyDetails }`   |
| `runIndeedScraper`         | `misceres/indeed-scraper`                 | `{ position, location, country, maxItemsPerSearch }` |
| `runNaukriScraper`         | `accurate_workstation/naukri-jobs-scraper-free` | `{ queries, location, maxPagesPerQuery }` |
| `runGlassdoorScraper`      | `fatihai-tools/glassdoor-jobs`            | `{ queries, location, maxPagesPerQuery }` |
| `runInternshalaScraper`    | `unfenced-group/internshala-scraper`      | `{ queries, location, maxPagesPerQuery }` |
| `runWellfoundScraper`      | `blackfalcondata/wellfound-scraper`       | `{ queries, location, maxPagesPerQuery }` |
| `runFounditScraper`        | `codingfrontend/foundit-jobs-scraper`     | `{ queries, location, maxPagesPerQuery }` |
| `runHiristScraper`         | `logiover/hirist-tech-scraper`            | `{ queries, location, maxPagesPerQuery }` |
| `runShineScraper`          | `unfenced-group/shine-scraper`            | `{ queries, location, maxPagesPerQuery }` |
| `runLinkedInPostScraper`   | `apify/linkedin-post-scraper`             | `{ searchQueries, maxPosts }`            |

**Normalization:** Each scraper's output is normalized to a common `ApifyDatasetItem` shape with fields: `title`, `company`, `location`, `url`, `date`, `type`, `description`, `salary`.

**Transformation functions:**
- `transformApifyItemToJob(item, platform)` → `Job` — Generates deterministic `job_id` via base64 hash of `platform-title-company-location`
- `transformApifyItemToLinkedInPost(item)` → `LinkedInHiringPost` — Auto-extracts keywords from a predefined list
- `buildBooleanSearchQuery(userInput)` → Wraps input with `("hiring" OR "looking for") AND (...)`

---

### 6.2 Google Sheets Service

**File:** `src/services/google-sheets.ts` (354 lines)

**Authentication:** Browser-based JWT signing using Web Crypto API (RS256). The JWT is exchanged for an OAuth2 access token via `https://oauth2.googleapis.com/token`. Tokens are cached for 1 hour.

**Sheets used:**
| Sheet Name               | Columns (A→K / A→G)                                  |
| ------------------------ | ---------------------------------------------------- |
| `All_Jobs_Master`        | job_id, source_platform, title, company, location, job_type, experience_req, url, date_posted, scraped_at, application_status |
| `LinkedIn_Hiring_Posts`  | post_id, author_name, author_title, post_text, post_url, detected_keywords, status |

**Key functions:**

| Function                  | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `testGCPConnection`       | Validates spreadsheet access with current credentials |
| `getExistingJobIds`      | Fetches column A of All_Jobs_Master for dedup        |
| `getExistingPostIds`     | Fetches column A of LinkedIn_Hiring_Posts for dedup  |
| `appendJobs`             | Appends new (non-duplicate) jobs to spreadsheet      |
| `appendLinkedInPosts`    | Appends new (non-duplicate) posts to spreadsheet     |
| `getAllJobs`             | Reads all job rows (A2:K)                            |
| `getAllLinkedInPosts`    | Reads all post rows (A2:G)                           |
| `updateJobStatus`        | Finds row by job_id, updates column K                |
| `updatePostStatus`       | Finds row by post_id, updates column G               |
| `wipeAllData`            | Clears all data rows (keeps headers)                 |

---

### 6.3 Config Store

**File:** `src/services/config.ts` (66 lines)

A thin wrapper over `localStorage` using key `huntsync_config`.

**Functions:**
- `getConfig()` → `AppConfig` — Returns merged config (defaults + stored overrides)
- `saveConfig(config)` — Serializes full config to localStorage
- `updateApifyConfig(updates)` — Partial update of Apify settings
- `updateGCPConfig(updates)` — Partial update of GCP settings
- `clearConfig()` — Removes all stored config

**Default Apify actor IDs** are pre-populated for all 10 scrapers (9 job boards + 1 post scraper).

---

## 7. Type System

**File:** `src/types/index.ts` (159 lines)

### Domain Types

| Type                 | Fields / Values                                                                 |
| -------------------- | ------------------------------------------------------------------------------- |
| `SourcePlatform`     | `"LinkedIn" \| "Indeed" \| "Naukri" \| "Glassdoor" \| "Internshala" \| "Wellfound" \| "Foundit" \| "Hirist" \| "Shine"` |
| `JobType`            | `"Remote" \| "WFO" \| "WFH"`                                                   |
| `ApplicationStatus`  | `"To Apply" \| "Applied" \| "Interviewing" \| "Rejected"`                      |
| `ExperienceLevel`    | `"0-1 years" \| "1-3 years" \| "Internship" \| "3-5 years" \| "5+ years"`     |
| `PostStatus`         | `"Unread" \| "Contacted" \| "Ignored"`                                         |
| `ScraperPlatform`    | Union of lowercase platform names + `"linkedin-posts"`                         |

### Interfaces

| Interface             | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `Job`                 | Full job record (11 fields)                       |
| `LinkedInHiringPost`  | Post record (7 fields)                            |
| `SearchFilter`        | Saved filter configuration                        |
| `ApifyPayload`        | Legacy payload shape                              |
| `ApifyConfig`         | API token + 10 actor IDs                          |
| `GCPConfig`           | Service account JSON key + spreadsheet ID         |
| `AppConfig`           | Combined `{ apify, gcp }`                         |
| `ScraperRun`          | Scraper execution state tracking                  |
| `ApifyRunResponse`    | Apify API run response                            |
| `ApifyDatasetItem`    | Normalized scraper output (flexible fields)       |
| `ConnectionStatus`    | UI state for Apify/GCP connection indicators     |

---

## 8. Data Flow

### Job Scraping Flow

```
User clicks "Scrape LinkedIn"
        │
        ▼
JobSearchTab.triggerScrapers(["LinkedIn"])
        │
        ├─► getConfig() → reads localStorage
        │
        ├─► runLinkedInScraper(config.apify, filter)
        │       │
        │       ├─► buildLinkedInSearchUrl(keywords, location)
        │       │
        │       └─► runScraperViaProxy(token, actorId, { searchUrls })
        │               │
        │               └─► POST to Supabase Edge Function
        │                       │
        │                       ├─► Edge Function calls Apify API
        │                       ├─► Waits for run completion (300s timeout)
        │                       └─► Returns dataset items
        │
        ├─► Normalize items → common ApifyDatasetItem shape
        │
        ├─► transformApifyItemToJob(item, "LinkedIn") → Job[]
        │
        ├─► appendJobs(config.gcp, jobs)
        │       │
        │       ├─► getExistingJobIds() → dedup check
        │       └─► POST to Google Sheets API (append rows)
        │
        └─► loadJobs() → refresh table from Sheets
```

### Google Sheets Auth Flow

```
getAccessToken(config)
        │
        ├─► Check cached token (valid for ~1 hour)
        │
        ├─► Parse service account JSON
        │
        ├─► Build JWT payload { iss, scope, aud, exp, iat }
        │
        ├─► signJWT() → Web Crypto API (RSASSA-PKCS1-v1_5 + SHA-256)
        │
        └─► POST to oauth2.googleapis.com/token
                │
                └─► Returns access_token (cached)
```

---

## 9. Supported Platforms

### Job Boards

| Platform      | Apify Actor                                      | Input Format          |
| ------------- | ------------------------------------------------ | --------------------- |
| LinkedIn      | `curious_coder/linkedin-jobs-scraper`            | Search URLs           |
| Indeed        | `misceres/indeed-scraper`                        | Position + Location   |
| Naukri        | `accurate_workstation/naukri-jobs-scraper-free`  | Query + Location      |
| Glassdoor     | `fatihai-tools/glassdoor-jobs`                   | Query + Location      |
| Internshala   | `unfenced-group/internshala-scraper`             | Query + Location      |
| Wellfound     | `blackfalcondata/wellfound-scraper`              | Query + Location      |
| Foundit       | `codingfrontend/foundit-jobs-scraper`            | Query + Location      |
| Hirist        | `logiover/hirist-tech-scraper`                   | Query + Location      |
| Shine         | `unfenced-group/shine-scraper`                   | Query + Location      |

### Social Listening

| Platform       | Apify Actor                            | Input Format        |
| -------------- | -------------------------------------- | ------------------- |
| LinkedIn Posts | `apify/linkedin-post-scraper`          | Boolean search queries |

---

## 10. Google Sheets Schema

### Sheet: `All_Jobs_Master`

| Column | Field              | Type / Values                                    |
| ------ | ------------------ | ------------------------------------------------ |
| A      | `job_id`           | String (base64 hash, 32 chars)                   |
| B      | `source_platform`  | LinkedIn / Indeed / Naukri / Glassdoor / ...     |
| C      | `title`            | String                                           |
| D      | `company`          | String                                           |
| E      | `location`         | String                                           |
| F      | `job_type`         | Remote / WFO / WFH                               |
| G      | `experience_req`   | String                                           |
| H      | `url`              | URL string                                       |
| I      | `date_posted`      | ISO date string                                  |
| J      | `scraped_at`       | ISO timestamp                                    |
| K      | `application_status` | To Apply / Applied / Interviewing / Rejected   |

### Sheet: `LinkedIn_Hiring_Posts`

| Column | Field                | Type / Values                          |
| ------ | -------------------- | -------------------------------------- |
| A      | `post_id`            | String (from Apify or base64 hash)     |
| B      | `author_name`        | String                                 |
| C      | `author_title`       | String                                 |
| D      | `post_text`          | String (full post content)             |
| E      | `post_url`           | URL string                             |
| F      | `detected_keywords`  | Comma-separated keywords               |
| G      | `status`             | Unread / Contacted / Ignored           |

---

## 11. Configuration & Environment

### Environment Variables (`.env`)

| Variable                | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `VITE_SUPABASE_URL`    | Supabase project URL (edge function host)  |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key                   |

> **Note:** The Supabase URL is currently hardcoded in `apify.ts` rather than read from env vars.

### localStorage Keys

| Key                 | Contents                                      |
| ------------------- | --------------------------------------------- |
| `huntsync_config`  | Full `AppConfig` JSON (Apify + GCP settings)  |
| `huntsync_filters` | Array of saved `SearchFilter` objects         |
| `theme`            | Current theme preference (dark/light/system)  |

---

## 12. Setup Guide

### Prerequisites
- Node.js 18+
- An [Apify](https://apify.com) account with API token
- A Google Cloud project with Sheets API enabled
- A GCP Service Account with JSON key
- A Google Spreadsheet shared with the service account email

### Installation

```bash
# Clone and install
git clone <repo-url>
cd job-Search-dashboard
npm install

# Start development server
npm run dev
```

### Configuration Steps

1. **Apify Setup:**
   - Sign up at [apify.com](https://apify.com)
   - Navigate to Account → Integrations → copy API token
   - Paste in the Configuration tab → Apify API Token field

2. **Google Cloud Setup:**
   - Create a GCP project → enable Google Sheets API
   - Create a Service Account → download JSON key
   - Paste the JSON key in Configuration tab → Service Account JSON Key

3. **Spreadsheet Setup:**
   - Create a new Google Spreadsheet
   - Add two sheets named: `All_Jobs_Master` and `LinkedIn_Hiring_Posts`
   - Share the spreadsheet with your service account email (Editor role)
   - Copy the Spreadsheet ID from the URL and paste in Configuration tab

4. **Test Connections:**
   - Click "Test Connection" for both Apify and GCP
   - Both should show green "Connected" badges

---

## 13. Development Commands

| Command           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Start Vite dev server with HMR                 |
| `npm run build`   | Type-check with `tsc -b`, then `vite build`    |
| `npm run typecheck` | Run `tsc --noEmit` for type checking only    |
| `npm run preview` | Preview production build locally               |

### TypeScript Configuration
- **Target:** ES2022
- **Module:** ESNext (bundler mode)
- **Strict mode:** Enabled (all checks including `noUnusedLocals`, `noUnusedParameters`)
- **Path alias:** `@/*` maps to `./src/*`
- **JSX:** `react-jsx`

---

## 14. UI Component Library

The project uses **shadcn/ui** built on **Radix UI** primitives, styled with **Tailwind CSS v4**.

### Theme System
- **OKLCH color space** for all theme tokens
- **Neutral base palette** with light/dark mode
- **ThemeProvider** (`src/components/theme-provider.tsx`) — Custom implementation supporting `dark`, `light`, `system` modes
- **Keyboard shortcut:** Press `D` (without modifiers, outside inputs) to toggle dark/light
- **Cross-tab sync:** Listens for `storage` events to sync theme across tabs

### Key UI Components Used

| Component          | Usage                                         |
| ------------------ | --------------------------------------------- |
| Tabs               | Main navigation (3 tabs)                      |
| Card               | Section containers                            |
| Table              | Job results grid                              |
| Select             | Status dropdowns, experience level            |
| Badge              | Platform tags, status indicators, keywords    |
| Input / Textarea   | Filter inputs, query builder, config fields   |
| Checkbox           | Job type multi-select                         |
| AlertDialog        | Destructive action confirmations              |
| ScrollArea         | Constrained-height scrollable regions         |
| DropdownMenu       | Theme toggle                                  |
| Sonner (Toaster)   | Toast notifications                           |

### Utility
- **`cn()`** (`src/lib/utils.ts`) — Merges Tailwind classes using `clsx` + `tailwind-merge`
