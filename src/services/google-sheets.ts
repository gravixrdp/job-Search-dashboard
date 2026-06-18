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
