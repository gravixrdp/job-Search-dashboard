# Architecture Overview

<cite>
**Referenced Files in This Document**
- [App.tsx](file://src/App.tsx)
- [main.tsx](file://src/main.tsx)
- [apify.ts](file://src/services/apify.ts)
- [google-sheets.ts](file://src/services/google-sheets.ts)
- [config.ts](file://src/services/config.ts)
- [job-search-tab.tsx](file://src/components/dashboard/job-search-tab.tsx)
- [social-listening-tab.tsx](file://src/components/dashboard/social-listening-tab.tsx)
- [config-tab.tsx](file://src/components/dashboard/config-tab.tsx)
- [types/index.ts](file://src/types/index.ts)
- [theme-provider.tsx](file://src/components/theme-provider.tsx)
- [mode-toggle.tsx](file://src/components/mode-toggle.tsx)
- [vite.config.ts](file://vite.config.ts)
- [package.json](file://package.json)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Security Considerations](#security-considerations)
9. [Scalability Considerations](#scalability-considerations)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Conclusion](#conclusion)

## Introduction
HuntSync AI is a React-based job search and social listening dashboard designed to aggregate job postings from multiple sources and track hiring signals on LinkedIn. The system follows a service-oriented architecture with clear separation between the UI layer, service layer, and external integrations. It integrates with Apify for web scraping and Google Sheets for persistent data storage, while maintaining a responsive UI built with modern React patterns and a theming provider.

## Project Structure
The project is organized around a clear separation of concerns:
- UI Layer: React components under src/components, including dashboard tabs and reusable UI primitives
- Services Layer: Encapsulated business logic for external integrations under src/services
- Types: Shared TypeScript interfaces and enums under src/types
- Application Entry: Root component rendering and theming provider setup
- Tooling: Vite configuration and Tailwind CSS integration

```mermaid
graph TB
subgraph "UI Layer"
APP["App.tsx"]
THEME["theme-provider.tsx"]
MODE["mode-toggle.tsx"]
DASH1["job-search-tab.tsx"]
DASH2["social-listening-tab.tsx"]
DASH3["config-tab.tsx"]
end
subgraph "Services Layer"
SVC1["apify.ts"]
SVC2["google-sheets.ts"]
SVC3["config.ts"]
end
subgraph "External Systems"
APIFY["Apify API"]
SHEETS["Google Sheets API"]
GCP["Google Cloud Platform"]
end
APP --> DASH1
APP --> DASH2
APP --> DASH3
DASH1 --> SVC1
DASH1 --> SVC2
DASH2 --> SVC1
DASH2 --> SVC2
DASH3 --> SVC3
SVC1 --> APIFY
SVC2 --> SHEETS
SHEETS --> GCP
```

**Diagram sources**
- [App.tsx:12-63](file://src/App.tsx#L12-L63)
- [apify.ts:1-348](file://src/services/apify.ts#L1-L348)
- [google-sheets.ts:1-354](file://src/services/google-sheets.ts#L1-L354)
- [config.ts:1-66](file://src/services/config.ts#L1-L66)

**Section sources**
- [vite.config.ts:1-15](file://vite.config.ts#L1-L15)
- [package.json:1-48](file://package.json#L1-L48)

## Core Components
The system centers around three primary dashboard tabs that expose distinct functionality while sharing common services and data models:

- Job Search Tab: Provides filtering capabilities, scraping orchestration across multiple job boards, and job listing management with status updates
- Social Listening Tab: Enables construction of boolean search queries to discover hiring posts and manage recruiter feed status
- Configuration Tab: Manages Apify and Google Sheets credentials, connection testing, and destructive operations

Shared services handle:
- Apify integration for web scraping job listings and LinkedIn posts
- Google Sheets API for data persistence and retrieval
- Local configuration management with localStorage

**Section sources**
- [job-search-tab.tsx:73-522](file://src/components/dashboard/job-search-tab.tsx#L73-L522)
- [social-listening-tab.tsx:36-275](file://src/components/dashboard/social-listening-tab.tsx#L36-L275)
- [config-tab.tsx:28-501](file://src/components/dashboard/config-tab.tsx#L28-L501)

## Architecture Overview
The architecture employs a layered pattern with explicit boundaries between UI, services, and external systems:

```mermaid
graph TB
subgraph "Presentation Layer"
UI_APP["App.tsx"]
UI_THEME["theme-provider.tsx"]
UI_MODE["mode-toggle.tsx"]
TABS["Dashboard Tabs"]
end
subgraph "Domain Services"
SVC_APIFY["apify.ts"]
SVC_SHEETS["google-sheets.ts"]
SVC_CONFIG["config.ts"]
end
subgraph "External Integrations"
EXT_APIFY["Apify Proxy Functions"]
EXT_SHEETS["Google Sheets API"]
EXT_GCP["GCP Authentication"]
end
subgraph "Data Models"
TYPES["types/index.ts"]
end
UI_APP --> TABS
UI_THEME --> UI_APP
UI_MODE --> UI_THEME
TABS --> SVC_APIFY
TABS --> SVC_SHEETS
TABS --> SVC_CONFIG
SVC_APIFY --> EXT_APIFY
SVC_SHEETS --> EXT_SHEETS
EXT_SHEETS --> EXT_GCP
SVC_APIFY -.-> TYPES
SVC_SHEETS -.-> TYPES
SVC_CONFIG -.-> TYPES
```

**Diagram sources**
- [App.tsx:12-63](file://src/App.tsx#L12-L63)
- [theme-provider.tsx:80-220](file://src/components/theme-provider.tsx#L80-L220)
- [apify.ts:1-348](file://src/services/apify.ts#L1-L348)
- [google-sheets.ts:1-354](file://src/services/google-sheets.ts#L1-L354)
- [config.ts:1-66](file://src/services/config.ts#L1-L66)
- [types/index.ts:1-159](file://src/types/index.ts#L1-L159)

## Detailed Component Analysis

### Service Layer Pattern
The service layer encapsulates all external integrations and business logic:

```mermaid
classDiagram
class ApifyService {
+testApifyConnection(token) Promise
+runLinkedInScraper(config, filter) Promise
+runIndeedScraper(config, filter) Promise
+runNaukriScraper(config, filter) Promise
+runGlassdoorScraper(config, filter) Promise
+runInternshalaScraper(config, filter) Promise
+runWellfoundScraper(config, filter) Promise
+runFounditScraper(config, filter) Promise
+runHiristScraper(config, filter) Promise
+runShineScraper(config, filter) Promise
+runLinkedInPostScraper(config, query) Promise
+transformApifyItemToJob(item, platform) Job
+transformApifyItemToLinkedInPost(item) LinkedInHiringPost
+buildBooleanSearchQuery(input) string
}
class GoogleSheetsService {
+testGCPConnection(config) Promise
+getExistingJobIds(config) Set
+getExistingPostIds(config) Set
+appendJobs(config, jobs) Promise
+appendLinkedInPosts(config, posts) Promise
+getAllJobs(config) Promise
+getAllLinkedInPosts(config) Promise
+updateJobStatus(config, jobId, status) Promise
+updatePostStatus(config, postId, status) Promise
+wipeAllData(config) Promise
}
class ConfigService {
+getConfig() AppConfig
+saveConfig(config) void
+updateApifyConfig(updates) ApifyConfig
+updateGCPConfig(updates) GCPConfig
+clearConfig() void
}
class DashboardComponents {
+JobSearchTab
+SocialListeningTab
+ConfigTab
}
DashboardComponents --> ApifyService : "uses"
DashboardComponents --> GoogleSheetsService : "uses"
DashboardComponents --> ConfigService : "uses"
```

**Diagram sources**
- [apify.ts:25-348](file://src/services/apify.ts#L25-L348)
- [google-sheets.ts:104-354](file://src/services/google-sheets.ts#L104-L354)
- [config.ts:26-66](file://src/services/config.ts#L26-L66)
- [job-search-tab.tsx:73-522](file://src/components/dashboard/job-search-tab.tsx#L73-L522)
- [social-listening-tab.tsx:36-275](file://src/components/dashboard/social-listening-tab.tsx#L36-L275)
- [config-tab.tsx:28-501](file://src/components/dashboard/config-tab.tsx#L28-L501)

### Data Flow: Job Scraping Pipeline
The job scraping process demonstrates the service-oriented architecture:

```mermaid
sequenceDiagram
participant User as "User"
participant Tab as "JobSearchTab"
participant Config as "ConfigService"
participant Apify as "ApifyService"
participant Proxy as "Apify Proxy"
participant Sheets as "GoogleSheetsService"
User->>Tab : Click "Scrape All"
Tab->>Config : getConfig()
Config-->>Tab : AppConfig
Tab->>Apify : runLinkedInScraper(config, filter)
Apify->>Proxy : POST /functions/v1/apify-proxy
Proxy-->>Apify : Dataset Items
Apify->>Apify : transformApifyItemToJob()
Apify-->>Tab : Jobs[]
alt GCP configured
Tab->>Sheets : appendJobs(jobs)
Sheets-->>Tab : Count
else Local state only
Tab->>Tab : Update local state
end
Tab-->>User : Show results
```

**Diagram sources**
- [job-search-tab.tsx:160-230](file://src/components/dashboard/job-search-tab.tsx#L160-L230)
- [apify.ts:84-146](file://src/services/apify.ts#L84-L146)
- [google-sheets.ts:162-200](file://src/services/google-sheets.ts#L162-L200)

### Data Flow: Social Listening Pipeline
The social listening workflow follows similar patterns:

```mermaid
sequenceDiagram
participant User as "User"
participant Tab as "SocialListeningTab"
participant Config as "ConfigService"
participant Apify as "ApifyService"
participant Proxy as "Apify Proxy"
participant Sheets as "GoogleSheetsService"
User->>Tab : Build Boolean Query
Tab->>Config : getConfig()
Config-->>Tab : AppConfig
Tab->>Apify : buildBooleanSearchQuery()
Tab->>Apify : runLinkedInPostScraper(config, query)
Apify->>Proxy : POST /functions/v1/apify-proxy
Proxy-->>Apify : Post Items
Apify->>Apify : transformApifyItemToLinkedInPost()
Apify-->>Tab : Posts[]
alt GCP configured
Tab->>Sheets : appendLinkedInPosts(posts)
Sheets-->>Tab : Count
else Local state only
Tab->>Tab : Update local state
end
Tab-->>User : Show posts
```

**Diagram sources**
- [social-listening-tab.tsx:62-95](file://src/components/dashboard/social-listening-tab.tsx#L62-L95)
- [apify.ts:289-347](file://src/services/apify.ts#L289-L347)
- [google-sheets.ts:202-236](file://src/services/google-sheets.ts#L202-L236)

### Component Hierarchy Starting from App.tsx
The component hierarchy demonstrates React's composition pattern:

```mermaid
graph TD
ROOT["main.tsx<br/>Application Root"] --> THEME["ThemeProvider<br/>Theme Management"]
THEME --> APP["App.tsx<br/>Main Application"]
APP --> HEADER["Header<br/>ModeToggle"]
APP --> TABS["Tabs<br/>Tab Navigation"]
TABS --> JOBS["JobSearchTab<br/>Job Discovery"]
TABS --> SOCIAL["SocialListeningTab<br/>Recruiter Feed"]
TABS --> CONFIG["ConfigTab<br/>Settings & Credentials"]
JOBS --> JOBS_FILTERS["Filter Builder<br/>Keywords & Locations"]
JOBS --> JOBS_TABLE["Results Table<br/>Status Management"]
SOCIAL --> QUERY_BUILDER["Boolean Query Builder<br/>Search Presets"]
SOCIAL --> POST_FEED["Recruiter Feed<br/>Post Management"]
CONFIG --> APIFY_CFG["Apify Configuration<br/>Connection Testing"]
CONFIG --> GCP_CFG["GCP Configuration<br/>Service Account Setup"]
```

**Diagram sources**
- [main.tsx:8-14](file://src/main.tsx#L8-L14)
- [App.tsx:12-63](file://src/App.tsx#L12-L63)
- [job-search-tab.tsx:247-521](file://src/components/dashboard/job-search-tab.tsx#L247-L521)
- [social-listening-tab.tsx:127-274](file://src/components/dashboard/social-listening-tab.tsx#L127-L274)
- [config-tab.tsx:118-501](file://src/components/dashboard/config-tab.tsx#L118-L501)

**Section sources**
- [main.tsx:1-15](file://src/main.tsx#L1-L15)
- [App.tsx:1-67](file://src/App.tsx#L1-L67)

## Dependency Analysis
The system maintains clean dependencies through TypeScript interfaces and modular service design:

```mermaid
graph LR
subgraph "Runtime Dependencies"
REACT["react & react-dom"]
LUCIDE["lucide-react"]
TAILWIND["tailwindcss"]
SONNER["sonner"]
RADIX["radix-ui"]
end
subgraph "Service Dependencies"
APIFY_CLIENT["apify-client"]
GOOGLEAPIS["googleapis"]
RECHARTS["recharts"]
DATEFNS["date-fns"]
end
subgraph "Development Dependencies"
VITE["vite & @vitejs/plugin-react"]
TYPESCRIPT["typescript"]
TAILWIND_VITE["@tailwindcss/vite"]
end
REACT --> LUCIDE
REACT --> SONNER
REACT --> RADIX
APIFY_CLIENT --> APIFY_CLIENT
GOOGLEAPIS --> GOOGLEAPIS
VITE --> TAILWIND_VITE
TYPESCRIPT --> TYPESCRIPT
```

**Diagram sources**
- [package.json:12-37](file://package.json#L12-L37)

**Section sources**
- [package.json:1-48](file://package.json#L1-L48)

## Performance Considerations
The system incorporates several performance optimizations:

- **Caching Strategy**: Google Sheets service caches access tokens with expiry management to minimize authentication overhead
- **Conditional Rendering**: Components render loading states and skeleton UI during asynchronous operations
- **Efficient Data Updates**: Batch operations for appending data to Google Sheets reduce API calls
- **Local State Management**: Filtering and UI state remain client-side to minimize network requests
- **Resource Loading**: Lazy loading patterns through React component composition

## Security Considerations
Security is addressed through multiple layers:

- **Configuration Storage**: Sensitive credentials are stored in localStorage with optional visibility toggles
- **Access Token Management**: Google Sheets API uses JWT-based authentication with proper key handling
- **Connection Testing**: Separate test endpoints validate external service connectivity without exposing secrets
- **Authorization Headers**: Proper OAuth2 token injection for external API calls
- **Environment Separation**: Supabase Edge Function proxy prevents direct exposure of Apify tokens

## Scalability Considerations
The architecture supports horizontal and vertical scaling:

- **Service Isolation**: Each external integration is encapsulated in dedicated services, enabling independent scaling
- **Batch Operations**: Google Sheets batch appends reduce API call frequency
- **Modular Components**: Dashboard tabs can be independently optimized and scaled
- **Caching Strategy**: Token caching reduces repeated authentication overhead
- **Asynchronous Processing**: Long-running scraping operations don't block the UI thread

## Troubleshooting Guide
Common issues and resolution strategies:

**Apify Connection Issues**
- Verify API token configuration in the Configuration tab
- Test connection using the built-in connection tester
- Check Apify actor IDs and ensure proper permissions

**Google Sheets Integration Problems**
- Confirm service account JSON key validity and private key presence
- Verify spreadsheet ID format and accessibility
- Ensure proper sharing permissions for the service account email
- Check token expiration and cache invalidation

**Data Persistence Issues**
- Use the wipe operation to reset corrupted data states
- Verify unique job ID generation and deduplication logic
- Monitor API rate limits and implement retry strategies

**UI State Synchronization**
- Local filters persist in localStorage for session continuity
- Theme preferences sync across browser tabs via localStorage events
- Toast notifications provide immediate feedback for user actions

**Section sources**
- [config-tab.tsx:43-89](file://src/components/dashboard/config-tab.tsx#L43-L89)
- [google-sheets.ts:104-119](file://src/services/google-sheets.ts#L104-L119)
- [apify.ts:25-42](file://src/services/apify.ts#L25-L42)

## Conclusion
HuntSync AI demonstrates a well-structured React application with clear service layer boundaries and robust integration patterns. The architecture successfully separates concerns between UI presentation, business logic encapsulation, and external system integration. The service-oriented design enables maintainability, testability, and future extensibility while providing a responsive user experience through thoughtful component composition and state management.

The system's modular approach to configuration management, data persistence, and external API integration creates a solid foundation for continued development and enhancement of job discovery and social listening capabilities.