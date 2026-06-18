// Apify API Service - Handles all scraping operations

import type {
  ApifyDatasetItem,
  Job,
  LinkedInHiringPost,
  SearchFilter,
} from "@/types"

// Re-export ApifyDatasetItem for use in components
export type { ApifyDatasetItem } from "@/types"

const APIFY_API_BASE = "https://api.apify.com/v2"

function generateJobId(job: ApifyDatasetItem, platform: string): string {
  const hash = `${platform}-${job.title || ""}-${job.company || ""}-${job.location || ""}`
  return btoa(hash).slice(0, 32)
}

function generatePostId(post: ApifyDatasetItem): string {
  return post.id || btoa(`${post.author || ""}-${post.postUrl || ""}`).slice(0, 32)
}

export async function testApifyConnection(apiToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${APIFY_API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    })
    if (response.ok) {
      return { success: true }
    }
    const error = await response.json()
    return { success: false, error: error.message || "Authentication failed" }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Connection failed" }
  }
}

// Build LinkedIn job search URL from keywords and location
function buildLinkedInSearchUrl(keywords: string, location: string): string {
  const params = new URLSearchParams()
  params.set("keywords", keywords)
  params.set("location", location)
  params.set("f_TPR", "r86400") // Past 24 hours
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`
}

export interface ScraperResult {
  items: ApifyDatasetItem[]
  platform: string
}

// Run scraper synchronously and get dataset items directly
async function runScraperSync(
  apiToken: string,
  actorId: string,
  input: Record<string, unknown>,
  timeoutSecs = 300
): Promise<ApifyDatasetItem[]> {
  const url = `${APIFY_API_BASE}/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSecs}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = "Failed to run scraper"
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.message || errorJson.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }
    throw new Error(errorMessage)
  }

  return response.json()
}

// LinkedIn Jobs Scraper - uses search URLs
export async function runLinkedInScraper(
  config: { apiToken: string; linkedinActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const searchUrl = buildLinkedInSearchUrl(keywords, location)

  const input = {
    searchUrls: [searchUrl],
    scrapeCompanyDetails: true,
  }

  const items = await runScraperSync(config.apiToken, config.linkedinActorId, input, 300)

  // Normalize LinkedIn output to common format
  const normalized: ApifyDatasetItem[] = items.map((item) => ({
    title: (item.title as string) || "",
    company: (item.companyName as string) || (item.company as string) || "",
    location: (item.location as string) || "",
    url: (item.link as string) || (item.url as string) || "",
    date: (item.postedAt as string) || (item.date as string) || "",
    type: (item.employmentType as string) || "",
    description: (item.descriptionText as string) || (item.description as string) || "",
    salary: Array.isArray(item.salaryInfo) ? (item.salaryInfo as string[]).join("-") : (item.salary as string) || "",
  }))

  return { items: normalized, platform: "LinkedIn" }
}

// Indeed Scraper - uses position and location
export async function runIndeedScraper(
  config: { apiToken: string; indeedActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const input = {
    position: keywords,
    location: location,
    country: "IN",
    maxItemsPerSearch: 100,
    saveOnlyUniqueItems: true,
  }

  const items = await runScraperSync(config.apiToken, config.indeedActorId, input, 300)

  // Normalize Indeed output to common format
  const normalized: ApifyDatasetItem[] = items.map((item) => ({
    title: (item.positionName as string) || (item.title as string) || "",
    company: (item.company as string) || "",
    location: (item.location as string) || "",
    url: (item.url as string) || "",
    date: (item.postedAt as string) || (item.date as string) || "",
    type: Array.isArray(item.jobType) ? (item.jobType as string[]).join(", ") : (item.jobType as string) || "",
    description: (item.description as string) || "",
    salary: (item.salary as string) || "",
  }))

  return { items: normalized, platform: "Indeed" }
}

// Naukri Scraper
export async function runNaukriScraper(
  config: { apiToken: string; naukriActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 2,
  }

  const items = await runScraperSync(config.apiToken, config.naukriActorId, input, 300)
  return { items: normalizeItems(items), platform: "Naukri" }
}

// Glassdoor Scraper
export async function runGlassdoorScraper(
  config: { apiToken: string; glassdoorActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 2,
  }

  const items = await runScraperSync(config.apiToken, config.glassdoorActorId, input, 300)
  return { items: normalizeItems(items), platform: "Glassdoor" }
}

// Internshala Scraper
export async function runInternshalaScraper(
  config: { apiToken: string; internshalaActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 2,
  }

  const items = await runScraperSync(config.apiToken, config.internshalaActorId, input, 300)
  return { items: normalizeItems(items), platform: "Internshala" }
}

// Wellfound Scraper
export async function runWellfoundScraper(
  config: { apiToken: string; wellfoundActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 2,
  }

  const items = await runScraperSync(config.apiToken, config.wellfoundActorId, input, 300)
  return { items: normalizeItems(items), platform: "Wellfound" }
}

// Foundit Scraper
export async function runFounditScraper(
  config: { apiToken: string; founditActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 2,
  }

  const items = await runScraperSync(config.apiToken, config.founditActorId, input, 300)
  return { items: normalizeItems(items), platform: "Foundit" }
}

// Hirist Scraper
export async function runHiristScraper(
  config: { apiToken: string; hiristActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 2,
  }

  const items = await runScraperSync(config.apiToken, config.hiristActorId, input, 300)
  return { items: normalizeItems(items), platform: "Hirist" }
}

// Shine Scraper
export async function runShineScraper(
  config: { apiToken: string; shineActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" ")
  const location = filter.locations.join(" ")

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 2,
  }

  const items = await runScraperSync(config.apiToken, config.shineActorId, input, 300)
  return { items: normalizeItems(items), platform: "Shine" }
}

// Normalize items from various scrapers to common format
function normalizeItems(items: ApifyDatasetItem[]): ApifyDatasetItem[] {
  return items.map((item: ApifyDatasetItem) => ({
    title: item.title || "",
    company: item.company || "",
    location: item.location || "",
    url: item.url || "",
    date: item.date || "",
    type: item.type || "",
    description: item.description || "",
    salary: item.salary || "",
  }))
}

// LinkedIn Post Scraper for Social Listening
export async function runLinkedInPostScraper(
  config: { apiToken: string; linkedinPostActorId: string },
  searchQuery: string
): Promise<ApifyDatasetItem[]> {
  const input = {
    searchQueries: [searchQuery],
    maxPosts: 50,
  }

  return runScraperSync(config.apiToken, config.linkedinPostActorId, input, 300)
}

export function transformApifyItemToJob(
  item: ApifyDatasetItem,
  platform: string
): Job {
  return {
    job_id: generateJobId(item, platform),
    source_platform: platform as Job["source_platform"],
    title: item.title || "",
    company: item.company || "",
    location: item.location || "",
    job_type: determineJobType(item.type || ""),
    experience_req: item.experience || "",
    url: item.url || "",
    date_posted: item.date || "",
    scraped_at: new Date().toISOString(),
    application_status: "To Apply",
  }
}

export function transformApifyItemToLinkedInPost(item: ApifyDatasetItem): LinkedInHiringPost {
  return {
    post_id: generatePostId(item),
    author_name: item.author || "",
    author_title: item.authorTitle || "",
    post_text: item.text || "",
    post_url: item.postUrl || "",
    detected_keywords: extractKeywords(item.text || ""),
    status: "Unread",
  }
}

function determineJobType(typeStr: string): Job["job_type"] {
  const lower = typeStr.toLowerCase()
  if (lower.includes("remote")) return "Remote"
  if (lower.includes("hybrid") || lower.includes("wfh")) return "WFH"
  return "WFO"
}

function extractKeywords(text: string): string {
  const keywords = ["DevOps", "Cloud", "Kubernetes", "AWS", "GCP", "Azure", "SRE", "Platform Engineer"]
  const found = keywords.filter((kw) => text.toLowerCase().includes(kw.toLowerCase()))
  return found.join(", ")
}

export function buildBooleanSearchQuery(userInput: string): string {
  return `("hiring" OR "looking for") AND (${userInput})`
}
