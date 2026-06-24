// Apify API Service - Handles all scraping operations via Cloudflare Worker

import type {
  ApifyDatasetItem,
  Job,
  LinkedInHiringPost,
  SearchFilter,
} from "@/types"

// Re-export ApifyDatasetItem for use in components
export type { ApifyDatasetItem } from "@/types"

function generateJobId(job: ApifyDatasetItem, platform: string): string {
  const hash = `${platform}-${job.title || ""}-${job.company || ""}-${job.location || ""}`
  return btoa(encodeURIComponent(hash)).slice(0, 32)
}

function generatePostId(post: ApifyDatasetItem): string {
  return post.id || btoa(encodeURIComponent(`${post.author || ""}-${post.postUrl || ""}`)).slice(0, 32)
}

export async function testApifyConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/apify/test", { method: "POST" })
    const data = await response.json() as { success: boolean; error?: string }
    return data
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

// Call Apify via our Cloudflare Worker
async function runScraperViaWorker(
  actorId: string,
  input: Record<string, unknown>
): Promise<ApifyDatasetItem[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minute timeout

  try {
    const response = await fetch("/api/apify/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId, input }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const error = await response.json() as { error?: string }
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json() as Promise<ApifyDatasetItem[]>
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Scraper timed out after 3 minutes. Please try again.")
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

// LinkedIn Jobs Scraper - uses search URLs
export async function runLinkedInScraper(
  config: { linkedinActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const searchUrls: string[] = [];
  
  // Generate search URLs for each combination of keyword and location
  for (const keyword of filter.keywords) {
    for (const location of filter.locations) {
      searchUrls.push(buildLinkedInSearchUrl(keyword, location));
    }
  }

  const input = {
    urls: searchUrls,
    scrapeCompany: true,
  };

  const items = await runScraperViaWorker(config.linkedinActorId, input);

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
  }));

  return { items: normalized, platform: "LinkedIn" };
}

// Indeed Scraper - uses position and location - optimize to avoid multiple subrequests
export async function runIndeedScraper(
  config: { indeedActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" OR ");
  const location = filter.locations.join(", ");

  const input = {
    position: keywords,
    location: location,
    country: "IN",
    maxItemsPerSearch: 150,
    saveOnlyUniqueItems: true,
  };

  const items = await runScraperViaWorker(config.indeedActorId, input);

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
  }));

  return { items: normalized, platform: "Indeed" };
}

// Naukri Scraper - optimize
export async function runNaukriScraper(
  config: { naukriActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" OR ");
  const location = filter.locations.join(", ");

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 3,
  };

  const items = await runScraperViaWorker(config.naukriActorId, input);
  return { items: normalizeItems(items), platform: "Naukri" };
}

// Glassdoor Scraper - optimize
export async function runGlassdoorScraper(
  config: { glassdoorActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" OR ");
  const location = filter.locations.join(", ");

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 3,
  };

  const items = await runScraperViaWorker(config.glassdoorActorId, input);
  return { items: normalizeItems(items), platform: "Glassdoor" };
}

// Internshala Scraper - optimize
export async function runInternshalaScraper(
  config: { internshalaActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" OR ");
  const location = filter.locations.join(", ");

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 3,
  };

  const items = await runScraperViaWorker(config.internshalaActorId, input);
  return { items: normalizeItems(items), platform: "Internshala" };
}

// Wellfound Scraper - optimize
export async function runWellfoundScraper(
  config: { wellfoundActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" OR ");
  const location = filter.locations.join(", ");

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 3,
  };

  const items = await runScraperViaWorker(config.wellfoundActorId, input);
  return { items: normalizeItems(items), platform: "Wellfound" };
}

// Foundit Scraper - optimize
export async function runFounditScraper(
  config: { founditActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" OR ");
  const location = filter.locations.join(", ");

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 3,
  };

  const items = await runScraperViaWorker(config.founditActorId, input);
  return { items: normalizeItems(items), platform: "Foundit" };
}

// Hirist Scraper - optimize
export async function runHiristScraper(
  config: { hiristActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" OR ");
  const location = filter.locations.join(", ");

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 3,
  };

  const items = await runScraperViaWorker(config.hiristActorId, input);
  return { items: normalizeItems(items), platform: "Hirist" };
}

// Shine Scraper - optimize
export async function runShineScraper(
  config: { shineActorId: string },
  filter: SearchFilter
): Promise<ScraperResult> {
  const keywords = filter.keywords.join(" OR ");
  const location = filter.locations.join(", ");

  const input = {
    queries: keywords,
    location: location,
    maxPagesPerQuery: 3,
  };

  const items = await runScraperViaWorker(config.shineActorId, input);
  return { items: normalizeItems(items), platform: "Shine" };
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
  config: { linkedinPostActorId: string },
  searchQuery: string
): Promise<ApifyDatasetItem[]> {
  const input = {
    searchQueries: [searchQuery],
    maxPosts: 50,
    sortBy: "date",
    postedLimit: "week",
  }

  return runScraperViaWorker(config.linkedinPostActorId, input)
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
    job_type: determineJobType(item.type || "", item.location || ""),
    experience_req: item.experience || "",
    url: item.url || "",
    date_posted: item.date || "",
    scraped_at: new Date().toISOString(),
    application_status: "To Apply",
  }
}

export function transformApifyItemToLinkedInPost(item: ApifyDatasetItem): LinkedInHiringPost {
  // Handle harvestapi/linkedin-post-search output format
  const authorObj = item.author as unknown as { name?: string; info?: string } | undefined
  const authorName = (typeof item.author === 'object' && authorObj?.name) ? authorObj.name : (item.author as unknown as string) || ""
  const authorTitle = (typeof item.author === 'object' && authorObj?.info) ? authorObj.info : item.authorTitle || ""
  const postText = item.content || item.text || ""
  const postUrl = item.linkedinUrl || item.postUrl || ""

  return {
    post_id: generatePostId(item),
    author_name: authorName,
    author_title: authorTitle,
    post_text: postText,
    post_url: postUrl,
    email: extractEmail(postText),
    experience_req: extractExperience(postText),
    detected_keywords: extractKeywords(postText),
    status: "Unread",
    scraped_at: new Date().toISOString(),
  }
}

function determineJobType(typeStr: string, locationStr: string = ""): Job["job_type"] {
  const lowerType = typeStr.toLowerCase()
  const lowerLoc = locationStr.toLowerCase()
  if (lowerType.includes("remote") || lowerLoc.includes("remote")) return "Remote"
  if (lowerType.includes("hybrid") || lowerType.includes("wfh") || lowerLoc.includes("hybrid") || lowerLoc.includes("wfh")) return "WFH"
  return "WFO"
}

function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ""
}

function extractExperience(text: string): string {
  // Match patterns like "3+ years", "2-5 years", "5 yrs experience"
  const yearPattern = text.match(/\b(\d+)\s*[-–+]?\s*(\d+)?\s*(years?|yrs?)\b/i)
  if (yearPattern) return yearPattern[0].trim()

  // Match "N years of experience"
  const expPattern = text.match(/\b(\d+)\s*years?\s*(of\s*)?experience\b/i)
  if (expPattern) return expPattern[0].trim()

  // Match level keywords
  const levelPattern = text.match(/\b(fresher|entry.level|junior|mid.level|senior)\b/i)
  if (levelPattern) return levelPattern[0].trim()

  return ""
}

function extractKeywords(text: string): string {
  const keywords = ["DevOps", "Cloud", "Kubernetes", "AWS", "GCP", "Azure", "SRE", "Platform Engineer"]
  const found = keywords.filter((kw) => text.toLowerCase().includes(kw.toLowerCase()))
  return found.join(", ")
}

export function buildBooleanSearchQuery(userInput: string): string {
  // Pass through directly — the user composes full boolean queries in the UI
  return userInput
}

// Helper function to check if job experience matches filter
export function matchesExperienceLevel(jobExperience: string, filterExperience: string): boolean {
  if (!jobExperience) return true;

  const jobExpLower = jobExperience.toLowerCase();
  
  // Extract numeric values from filter
  let filterMinYears: number | null = null;
  let filterMaxYears: number | null = null;

  if (filterExperience === "Internship") {
    return jobExpLower.includes("intern");
  }

  const filterMatch = filterExperience.match(/(\d+)-?(\d+)?/);
  if (filterMatch) {
    filterMinYears = parseInt(filterMatch[1]);
    if (filterMatch[2]) {
      filterMaxYears = parseInt(filterMatch[2]);
    }
  }

  // Check if job experience mentions any relevant years
  const jobYearsMatch = jobExpLower.match(/(\d+)/);
  if (!jobYearsMatch) {
    return true; // If we can't determine, include it
  }

  const jobYears = parseInt(jobYearsMatch[1]);

  if (filterMaxYears !== null) {
    return jobYears >= filterMinYears! && jobYears <= filterMaxYears;
  } else if (filterExperience.includes("+")) {
    return jobYears >= filterMinYears!;
  } else {
    return jobYears === filterMinYears;
  }
}

// Helper function to check if job matches all filters
export function matchesAllFilters(job: Job, filter: SearchFilter): boolean {
  // Location filter
  if (filter.locations.length > 0) {
    const jobLoc = job.location.toLowerCase();
    const matchesLocation = filter.locations.some((loc) => {
      const lower = loc.toLowerCase();
      if (lower === "remote") {
        return jobLoc.includes("remote") || job.job_type === "Remote";
      }
      return jobLoc.includes(lower);
    });
    if (!matchesLocation) return false;
  }

  // Job type filter
  if (filter.job_types.length > 0) {
    if (!filter.job_types.includes(job.job_type)) return false;
  }

  // Experience level filter
  if (!matchesExperienceLevel(job.experience_req, filter.experience)) return false;

  return true;
}
