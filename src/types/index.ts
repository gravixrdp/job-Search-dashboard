// HuntSync AI Data Types

// ============================================================================
// Job Board Types (All_Jobs_Master Sheet)
// ============================================================================

export type SourcePlatform = "LinkedIn" | "Indeed" | "Naukri" | "Glassdoor" | "Internshala" | "Wellfound" | "Foundit" | "Hirist" | "Shine"
export type JobType = "Remote" | "WFO" | "WFH"
export type ApplicationStatus = "To Apply" | "Applied" | "Interviewing" | "Rejected"

export interface Job {
  job_id: string
  source_platform: SourcePlatform
  title: string
  company: string
  location: string
  job_type: JobType
  experience_req: string
  url: string
  date_posted: string
  scraped_at: string
  application_status: ApplicationStatus
}

// ============================================================================
// LinkedIn Hiring Posts Types (LinkedIn_Hiring_Posts Sheet)
// ============================================================================

export type PostStatus = "Unread" | "Contacted" | "Ignored"

export interface LinkedInHiringPost {
  post_id: string
  author_name: string
  author_title: string
  post_text: string
  post_url: string
  email: string
  experience_req: string
  detected_keywords: string
  status: PostStatus
  scraped_at: string
}

// ============================================================================
// Search Filter Types
// ============================================================================

export interface SearchFilter {
  id: string
  name: string
  keywords: string[]
  experience: ExperienceLevel
  locations: string[]
  job_types: JobType[]
  created_at: string
  updated_at: string
}

export type ExperienceLevel = "0-1 years" | "1-3 years" | "Internship" | "3-5 years" | "5+ years"

export interface ApifyPayload {
  queries: string
  location: string
  maxPagesPerQuery: number
  publishedAt: string
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ApifyConfig {
  apiToken: string
  hasToken?: boolean
  canManageSecrets?: boolean
  linkedinActorId: string
  indeedActorId: string
  naukriActorId: string
  glassdoorActorId: string
  internshalaActorId: string
  wellfoundActorId: string
  founditActorId: string
  hiristActorId: string
  shineActorId: string
  linkedinPostActorId: string
}

export interface GCPConfig {
  serviceAccountKey: string
  spreadsheetId: string
}

export interface MailbotConfig {
  gmailUser: string
  gmailPass: string
  emailSubject: string
  emailTemplate: string
}

export interface SentLogEntry {
  domain: string
  email: string
  company: string
  sent_at: string
  status: "sent" | "bounced"
}

export interface AppConfig {
  apify: ApifyConfig
  gcp: GCPConfig
  mailbot: MailbotConfig
}

// ============================================================================
// Scraper Types
// ============================================================================

export type ScraperPlatform = "linkedin" | "indeed" | "naukri" | "glassdoor" | "internshala" | "wellfound" | "foundit" | "hirist" | "shine" | "linkedin-posts"

export interface ScraperRun {
  id: string
  platform: ScraperPlatform
  status: "idle" | "running" | "completed" | "failed"
  startedAt?: string
  completedAt?: string
  itemsFound?: number
  error?: string
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApifyRunResponse {
  id: string
  status: string
  defaultDatasetId: string
}

export interface ApifyDatasetItem {
  id?: string
  title?: string
  company?: string
  location?: string
  type?: string
  experience?: string
  url?: string
  date?: string
  description?: string
  salary?: string
  // LinkedIn specific
  companyName?: string
  link?: string
  postedAt?: string
  employmentType?: string
  descriptionText?: string
  salaryInfo?: string[]
  // Indeed specific
  positionName?: string
  jobType?: string | string[]
  // LinkedIn Post specific fields
  text?: string
  author?: string | { name?: string; info?: string; publicIdentifier?: string; linkedinUrl?: string }
  authorTitle?: string
  postUrl?: string
  // harvestapi/linkedin-post-search output fields
  content?: string
  linkedinUrl?: string
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ConnectionStatus {
  apify: "unknown" | "connected" | "error"
  gcp: "unknown" | "connected" | "error"
  lastChecked?: string
  error?: string
}

export type ActiveTab = "jobs" | "social" | "config" | "mailbot"
