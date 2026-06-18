// Data Service - Handles all data operations via Cloudflare Worker API
// Primary storage: Cloudflare D1 | Backup: Google Sheets (handled server-side by Worker)

import type { Job, LinkedInHiringPost } from "@/types"

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function getAllJobs(): Promise<Job[]> {
  const response = await fetch("/api/jobs")
  if (!response.ok) return []
  return (await response.json()) as Job[]
}

export async function appendJobs(jobs: Job[]): Promise<number> {
  if (jobs.length === 0) return 0

  const response = await fetch("/api/jobs/append", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobs }),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(error.error || "Failed to append jobs")
  }

  const data = await response.json() as { added: number }
  return data.added
}

export async function updateJobStatus(jobId: string, status: string): Promise<void> {
  const response = await fetch("/api/jobs/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, status }),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(error.error || "Failed to update job status")
  }
}

// ─── LinkedIn Posts ─────────────────────────────────────────────────────────

export async function getAllLinkedInPosts(): Promise<LinkedInHiringPost[]> {
  const response = await fetch("/api/posts")
  if (!response.ok) return []
  return (await response.json()) as LinkedInHiringPost[]
}

export async function appendLinkedInPosts(posts: LinkedInHiringPost[]): Promise<number> {
  if (posts.length === 0) return 0

  const response = await fetch("/api/posts/append", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ posts }),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(error.error || "Failed to append posts")
  }

  const data = await response.json() as { added: number }
  return data.added
}

export async function updatePostStatus(postId: string, status: string): Promise<void> {
  const response = await fetch("/api/posts/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, status }),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(error.error || "Failed to update post status")
  }
}

// ─── Wipe ───────────────────────────────────────────────────────────────────

export async function wipeAllData(): Promise<void> {
  const response = await fetch("/api/wipe", { method: "POST" })
  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(error.error || "Failed to wipe data")
  }
}
// Google Sheets API Service - Handles all data persistence via Google Sheets

import type { Job, LinkedInHiringPost, GCPConfig } from "@/types"

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets"
const JOBS_SHEET = "All_Jobs_Master"
const POSTS_SHEET = "LinkedIn_Hiring_Posts"

let cachedAccessToken: string | null = null
let tokenExpiry: number = 0

async function getAccessToken(config: GCPConfig): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken
  }

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(config.serviceAccountKey)
  } catch {
    throw new Error("Invalid service account JSON")
  }

  // Use JWT assertion for OAuth2 token
  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }

  // For browser environment, we'll use the REST API directly with JWT
  // This requires the private_key to sign the JWT
  const privateKey = credentials.private_key as string
  if (!privateKey) {
    throw new Error("Service account missing private_key")
  }

  // Import crypto for signing
  const token = await signJWT(jwtPayload, privateKey)

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to get access token: ${error}`)
  }

  const tokenData = await tokenResponse.json()
  cachedAccessToken = tokenData.access_token as string
  tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000

  return cachedAccessToken
}

async function signJWT(payload: Record<string, unknown>, privateKey: string): Promise<string> {
  // Web Crypto API for JWT signing
  const header = { alg: "RS256", typ: "JWT" }
  const encoder = new TextEncoder()

  const base64url = (data: string) =>
    btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  // Import the private key
  const keyData = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "")
    .trim()

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signingInput)
  )

  const encodedSignature = base64url(
    String.fromCharCode(...new Uint8Array(signature))
  )

  return `${signingInput}.${encodedSignature}`
}

export async function testGCPConnection(config: GCPConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(config)
    const response = await fetch(`${SHEETS_API_BASE}/${config.spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (response.ok) {
      return { success: true }
    }
    const error = await response.json()
    return { success: false, error: error.error?.message || "Failed to access spreadsheet" }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Connection failed" }
  }
}

async function sheetsFetch(
  config: GCPConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = await getAccessToken(config)
  const url = path.startsWith("http")
    ? path
    : `${SHEETS_API_BASE}/${config.spreadsheetId}${path}`

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
}

export async function getExistingJobIds(config: GCPConfig): Promise<Set<string>> {
  const response = await sheetsFetch(config, `/values/${JOBS_SHEET}!A:A`)
  if (!response.ok) {
    // Sheet might not exist yet
    return new Set()
  }
  const data = await response.json()
  const ids = (data.values || []).flat()
  return new Set(ids)
}

export async function getExistingPostIds(config: GCPConfig): Promise<Set<string>> {
  const response = await sheetsFetch(config, `/values/${POSTS_SHEET}!A:A`)
  if (!response.ok) {
    return new Set()
  }
  const data = await response.json()
  const ids = (data.values || []).flat()
  return new Set(ids)
}

export async function appendJobs(config: GCPConfig, jobs: Job[]): Promise<number> {
  if (jobs.length === 0) return 0

  // Check for duplicates
  const existingIds = await getExistingJobIds(config)
  const newJobs = jobs.filter((job) => !existingIds.has(job.job_id))

  if (newJobs.length === 0) return 0

  const values = newJobs.map((job) => [
    job.job_id,
    job.source_platform,
    job.title,
    job.company,
    job.location,
    job.job_type,
    job.experience_req,
    job.url,
    job.date_posted,
    job.scraped_at,
    job.application_status,
  ])

  const response = await sheetsFetch(config, `/values/${JOBS_SHEET}!A:K:append`, {
    method: "POST",
    body: JSON.stringify({
      values,
      insertDataOption: "INSERT_ROWS",
      valueInputOption: "RAW",
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Failed to append jobs")
  }

  return newJobs.length
}

export async function appendLinkedInPosts(config: GCPConfig, posts: LinkedInHiringPost[]): Promise<number> {
  if (posts.length === 0) return 0

  // Check for duplicates
  const existingIds = await getExistingPostIds(config)
  const newPosts = posts.filter((post) => !existingIds.has(post.post_id))

  if (newPosts.length === 0) return 0

  const values = newPosts.map((post) => [
    post.post_id,
    post.author_name,
    post.author_title,
    post.post_text,
    post.post_url,
    post.detected_keywords,
    post.status,
  ])

  const response = await sheetsFetch(config, `/values/${POSTS_SHEET}!A:G:append`, {
    method: "POST",
    body: JSON.stringify({
      values,
      insertDataOption: "INSERT_ROWS",
      valueInputOption: "RAW",
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Failed to append posts")
  }

  return newPosts.length
}

export async function getAllJobs(config: GCPConfig): Promise<Job[]> {
  const response = await sheetsFetch(config, `/values/${JOBS_SHEET}!A2:K`)
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  const values = data.values || []

  return values.map((row: string[]) => ({
    job_id: row[0] || "",
    source_platform: row[1] as Job["source_platform"] || "LinkedIn",
    title: row[2] || "",
    company: row[3] || "",
    location: row[4] || "",
    job_type: row[5] as Job["job_type"] || "Remote",
    experience_req: row[6] || "",
    url: row[7] || "",
    date_posted: row[8] || "",
    scraped_at: row[9] || "",
    application_status: row[10] as Job["application_status"] || "To Apply",
  }))
}

export async function getAllLinkedInPosts(config: GCPConfig): Promise<LinkedInHiringPost[]> {
  const response = await sheetsFetch(config, `/values/${POSTS_SHEET}!A2:G`)
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  const values = data.values || []

  return values.map((row: string[]) => ({
    post_id: row[0] || "",
    author_name: row[1] || "",
    author_title: row[2] || "",
    post_text: row[3] || "",
    post_url: row[4] || "",
    detected_keywords: row[5] || "",
    status: row[6] as LinkedInHiringPost["status"] || "Unread",
  }))
}

export async function updateJobStatus(
  config: GCPConfig,
  jobId: string,
  status: string
): Promise<void> {
  // Find the row with this job_id and update the status column (column K)
  const response = await sheetsFetch(
    config,
    `/values/${JOBS_SHEET}!A:K?majorDimension=ROWS`
  )
  if (!response.ok) {
    throw new Error("Failed to find job")
  }
  const data = await response.json()
  const values = data.values || []

  const rowIndex = values.findIndex((row: string[]) => row[0] === jobId)
  if (rowIndex === -1) {
    throw new Error("Job not found")
  }

  const updateResponse = await sheetsFetch(
    config,
    `/values/${JOBS_SHEET}!K${rowIndex + 1}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [[status]] }),
    }
  )

  if (!updateResponse.ok) {
    throw new Error("Failed to update job status")
  }
}

export async function updatePostStatus(
  config: GCPConfig,
  postId: string,
  status: string
): Promise<void> {
  const response = await sheetsFetch(
    config,
    `/values/${POSTS_SHEET}!A:G?majorDimension=ROWS`
  )
  if (!response.ok) {
    throw new Error("Failed to find post")
  }
  const data = await response.json()
  const values = data.values || []

  const rowIndex = values.findIndex((row: string[]) => row[0] === postId)
  if (rowIndex === -1) {
    throw new Error("Post not found")
  }

  const updateResponse = await sheetsFetch(
    config,
    `/values/${POSTS_SHEET}!G${rowIndex + 1}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [[status]] }),
    }
  )

  if (!updateResponse.ok) {
    throw new Error("Failed to update post status")
  }
}

export async function wipeAllData(config: GCPConfig): Promise<void> {
  // Clear both sheets
  await sheetsFetch(config, `/values/${JOBS_SHEET}!A2:K:clear`, { method: "POST" })
  await sheetsFetch(config, `/values/${POSTS_SHEET}!A2:G:clear`, { method: "POST" })
}
