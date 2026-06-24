# HuntSync AI Memory System Documentation

## Overview
This document describes the structured memory system for the HuntSync AI project, designed for easy consumption by both human developers and AI agents.

## Backward Compatibility
- **`memory.md`**: Original human-readable Markdown file (maintained for backward compatibility)
- **`memory.json`**: New machine-readable structured memory file (recommended for AI agent use)

## File Structure
```
job-Search-dashboard/
├── memory.md                # Original Markdown memory (human-readable)
├── memory.json              # Structured JSON memory (machine-readable)
├── memory-query.ts          # Query interface (TypeScript)
└── MEMORY_SYSTEM.md         # This documentation file
```

## memory.json Schema
### Root Level
| Field | Type | Description |
|-------|------|-------------|
| `$schema` | string | Schema URL for validation |
| `metadata` | object | Memory metadata (createdAt, lastUpdatedAt, author, etc.) |
| `projectOverview` | object | High-level project info |
| `technologyStack` | object | Tech stack breakdown by category |
| `architecture` | object | Frontend/backend architecture |
| `keyFeatures` | array | Detailed feature descriptions |
| `dataModels` | object | Database schema and TypeScript types |
| `apiRoutes` | object | All API endpoints |
| `apifyIntegration` | object | Apify scraper details |
| `deploymentEnvironment` | object | Deployment config and commands |
| `criticalPathsAndGotchas` | array | Important notes and pitfalls |
| `quickReference` | object | File locations and key constants |

### Querying the Memory
We provide a TypeScript query interface in `memory-query.ts` for easy programmatic access.

### Usage Examples
#### JavaScript/TypeScript
```typescript
import { loadMemory, getFeature, getApiRoutes } from './memory-query';

// Load the memory
const memory = await loadMemory();

// Get a specific feature
const jobSearchTab = getFeature(memory, 'job-search-tab');

// Get API routes
const allApis = getApiRoutes(memory);
```

#### Direct JSON Access
For AI agents that can parse JSON directly, use the keys in `memory.json` for quick lookup.

## Version History
- **v1.0.0** (2026-06-25): Initial structured memory system
