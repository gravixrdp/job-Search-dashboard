// Apify API Service - Handles all scraping operations via Supabase Edge Function

import type {
  ApifyDatasetItem,
  Job,
  LinkedInHiringPost,
  SearchFilter,
} from "@/types"

// Re-export ApifyDatasetItem for use in components
export type { ApifyDatasetItem } from "@/types"

// Get Supabase URL from environment
const SUPABASE_URL = "https://wagrohholwpjvfrxoefc.supabase.co"

function generateJobId(job: ApifyDatasetItem, platform: string): string {
  const hash = `${platform}-${job.title || ""}-${job.company || ""}-${job.location || ""}`
  return btoa(hash).slice(0, 32)
}

function generatePostId(post: ApifyDatasetItem): string {
  return post.id || btoa(`${post.author || ""}-${post.postUrl || ""}`).slice(0, 32)
}

export async function testApifyConnection(apiToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/apify-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: "users/me",
        input: {},
        apiToken,
      }),
    })

    // Even if users/me fails, we tested connectivity
    return { success: response.ok || response.status !== 0 }
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

// Call Apify via our Supabase Edge Function
async function runScraperViaProxy(
  apiToken: string,
  actorId: string,
  input: Record<string, unknown>
): Promise<ApifyDatasetItem[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/apify-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actorId,
      input,
      apiToken,
      timeoutSecs: 300,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `HTTP ${response.status}`)
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

  const items = await runScraperViaProxy(config.apiToken, config.linkedinActorId, input)

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

  const items = await runScraperViaProxy(config.apiToken, config.indeedActorId, input)

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

  const items = await runScraperViaProxy(config.apiToken, config.naukriActorId, input)
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

  const items = await runScraperViaProxy(config.apiToken, config.glassdoorActorId, input)
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

  const items = await runScraperViaProxy(config.apiToken, config.internshalaActorId, input)
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

  const items = await runScraperViaProxy(config.apiToken, config.wellfoundActorId, input)
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

  const items = await runScraperViaProxy(config.apiToken, config.founditActorId, input)
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

  const items = await runScraperViaProxy(config.apiToken, config.hiristActorId, input)
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

  const items = await runScraperViaProxy(config.apiToken, config.shineActorId, input)
  return { items: normalizeItems(items), platform: "Shine" }
}

// Normalize items from various scrapers to common format
function normalizeItems(items: ApifyDatasetItem[]): ApifyDatasetItem[] {
  return items.map((item) => ({
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

  return runScraperViaProxy(config.apiToken, config.linkedinPostActorId, input)
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
