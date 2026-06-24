// HuntSync AI — Cloudflare Worker (Full-Stack)
// Serves the React SPA and handles all API routes with D1 + Google Sheets backup

import type { D1Database, ExecutionContext } from "cloudflare:workers"

export interface Env {
  DB: D1Database
  ASSETS: { fetch: typeof fetch }
  APIFY_TOKEN: string
  CF_ACCOUNT_ID: string
  CF_API_TOKEN: string
  GCP_SERVICE_ACCOUNT_KEY: string
  GCP_SPREADSHEET_ID: string
}

// ─── Default Apify Actor IDs ────────────────────────────────────────────────
const DEFAULT_ACTOR_IDS: Record<string, string> = {
  linkedinActorId: "curious_coder/linkedin-jobs-scraper",
  indeedActorId: "misceres/indeed-scraper",
  naukriActorId: "accurate_workstation/naukri-jobs-scraper-free",
  glassdoorActorId: "fatihai-tools/glassdoor-jobs",
  internshalaActorId: "unfenced-group/internshala-scraper",
  wellfoundActorId: "blackfalcondata/wellfound-scraper",
  founditActorId: "codingfrontend/foundit-jobs-scraper",
  hiristActorId: "logiover/hirist-tech-scraper",
  shineActorId: "unfenced-group/shine-scraper",
  linkedinPostActorId: "harvestapi/linkedin-post-search",
}

const WORKER_SCRIPT_NAME = "huntsync-ai"

// ─── Helpers ────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function error(msg: string, status = 400): Response {
  return json({ error: msg }, status)
}

async function getBody<T>(req: Request): Promise<T> {
  return (await req.json()) as T
}

// Get the effective Apify token: D1 override takes priority over env secret
async function getApifyToken(env: Env): Promise<string> {
  try {
    const row = await env.DB.prepare("SELECT value FROM config WHERE key = ?").bind("apify_token").first() as { value: string } | null
    if (row?.value) return row.value
  } catch { /* ignore */ }
  return env.APIFY_TOKEN || ""
}

// Sync a value to a Cloudflare Worker secret via the Cloudflare API
async function syncCFSecret(env: Env, secretName: string, secretValue: string): Promise<{ success: boolean; error?: string }> {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return { success: false, error: "CF_API_TOKEN and CF_ACCOUNT_ID must be configured. Set CF_API_TOKEN as a secret via wrangler or Cloudflare Dashboard." }
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${WORKER_SCRIPT_NAME}/secrets`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: secretName, text: secretValue }),
      }
    )
    if (!res.ok) {
      const err = await res.json() as { errors?: Array<{ message: string }> }
      return { success: false, error: err.errors?.[0]?.message || `CF API returned ${res.status}` }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "CF API call failed" }
  }
}

// Remove a Cloudflare Worker secret via the Cloudflare API
async function removeCFSecret(env: Env, secretName: string): Promise<{ success: boolean; error?: string }> {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return { success: false, error: "CF_API_TOKEN and CF_ACCOUNT_ID must be configured." }
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${WORKER_SCRIPT_NAME}/secrets/${secretName}`,
      {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${env.CF_API_TOKEN}` },
      }
    )
    if (!res.ok) {
      const err = await res.json() as { errors?: Array<{ message: string }> }
      return { success: false, error: err.errors?.[0]?.message || `CF API returned ${res.status}` }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "CF API call failed" }
  }
}

// ─── Google Sheets Server-Side Auth (RS256 JWT via Web Crypto) ──────────────
let cachedToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const creds = JSON.parse(serviceAccountKey)
  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }

  const header = { alg: "RS256", typ: "JWT" }
  const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  const signingInput = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(jwtPayload))}`

  const keyData = (creds.private_key as string)
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "")
    .trim()

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  )

  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput))
  const token = `${signingInput}.${b64(String.fromCharCode(...new Uint8Array(sig)))}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
  })

  if (!res.ok) throw new Error(`Token error: ${await res.text()}`)
  const data = await res.json() as Record<string, unknown>
  cachedToken = data.access_token as string
  tokenExpiry = Date.now() + ((data.expires_in as number) - 60) * 1000
  return cachedToken!
}

async function sheetsFetch(spreadsheetId: string, accessToken: string, path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
}

// ─── Google Sheets Backup Functions ─────────────────────────────────────────
async function backupJobsToSheets(
  spreadsheetId: string, serviceAccountKey: string,
  jobs: Array<Record<string, string>>
): Promise<void> {
  try {
    const token = await getAccessToken(serviceAccountKey)
    const values = jobs.map((j) => [
      j.job_id, j.source_platform, j.title, j.company, j.location,
      j.job_type, j.experience_req, j.url, j.date_posted, j.scraped_at, j.application_status,
    ])
    await sheetsFetch(spreadsheetId, token, `/values/All_Jobs_Master!A:K:append`, {
      method: "POST",
      body: JSON.stringify({ values, insertDataOption: "INSERT_ROWS", valueInputOption: "RAW" }),
    })
  } catch (e) {
    console.error("Sheets backup (jobs) failed:", e)
  }
}

async function backupPostsToSheets(
  spreadsheetId: string, serviceAccountKey: string,
  posts: Array<Record<string, string>>
): Promise<void> {
  try {
    const token = await getAccessToken(serviceAccountKey)
    const values = posts.map((p) => [
      p.post_id, p.author_name, p.author_title, p.post_text, p.post_url, p.email || "", p.experience_req || "", p.detected_keywords, p.scraped_at || "", p.status,
    ])
    await sheetsFetch(spreadsheetId, token, `/values/LinkedIn_Hiring_Posts!A:J:append`, {
      method: "POST",
      body: JSON.stringify({ values, insertDataOption: "INSERT_ROWS", valueInputOption: "RAW" }),
    })
  } catch (e) {
    console.error("Sheets backup (posts) failed:", e)
  }
}

async function wipeSheets(spreadsheetId: string, serviceAccountKey: string): Promise<void> {
  try {
    const token = await getAccessToken(serviceAccountKey)
    await sheetsFetch(spreadsheetId, token, `/values/All_Jobs_Master!A2:K:clear`, { method: "POST" })
    await sheetsFetch(spreadsheetId, token, `/values/LinkedIn_Hiring_Posts!A2:J:clear`, { method: "POST" })
  } catch (e) {
    console.error("Sheets wipe failed:", e)
  }
}

// ─── Apify Proxy ────────────────────────────────────────────────────────────
async function runApifyScraper(apiToken: string, actorId: string, input: Record<string, unknown>): Promise<unknown> {
  // 1. Start the run WITHOUT blocking (waitForFinish=0)
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${apiToken}&waitForFinish=0`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  )

  if (!runRes.ok) throw new Error(`Apify run failed: ${runRes.status}`)
  const runData = await runRes.json() as Record<string, unknown>
  const runObj = runData.data as Record<string, unknown>
  const runId = runObj.id as string
  const datasetId = runObj.defaultDatasetId as string

  // 2. Poll for run completion (short requests instead of one long-blocking call)
  // Dynamic intervals: 2s for first 5 attempts, then 5s for next 10, then 10s thereafter.
  // This keeps quick runs fast while staying well under Cloudflare's 50 subrequests limit.
  let elapsed = 0
  const maxDurationMs = 120000 // 120 seconds max polling duration
  let attempts = 0

  while (elapsed < maxDurationMs) {
    let delay = 2000
    if (attempts >= 15) {
      delay = 10000
    } else if (attempts >= 5) {
      delay = 5000
    }

    await new Promise((r) => setTimeout(r, delay))
    elapsed += delay
    attempts++

    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs/${runId}?token=${apiToken}`
    )
    if (!statusRes.ok) continue
    const statusData = await statusRes.json() as Record<string, unknown>
    const statusObj = statusData.data as Record<string, unknown>
    const status = statusObj.status as string
    if (status === "SUCCEEDED" || status === "ABORTED" || status === "FAILED" || status === "TIMED-OUT") {
      break
    }
  }

  // 3. Fetch dataset items
  const dsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
  )
  if (!dsRes.ok) throw new Error(`Apify dataset fetch failed: ${dsRes.status}`)
  return dsRes.json()
}

// ─── Route Handlers ─────────────────────────────────────────────────────────
async function handleApi(url: URL, req: Request, env: Env): Promise<Response> {
  const path = url.pathname
  const method = req.method

  // ── Apify Routes ────────────────────────────────────────────────────────
  if (path === "/api/apify/test" && method === "POST") {
    const token = await getApifyToken(env)
    if (!token) return error("Apify API token not configured. Add it in the dashboard Settings.", 500)
    try {
      const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`)
      if (res.ok) return json({ success: true })
      return json({ success: false, error: `Apify returned ${res.status} — check your token` })
    } catch (e) {
      return json({ success: false, error: e instanceof Error ? e.message : "Connection failed" })
    }
  }

  if (path === "/api/apify/run" && method === "POST") {
    const token = await getApifyToken(env)
    if (!token) return error("Apify API token not configured. Add it in the dashboard Settings.", 500)
    try {
      const body = await getBody<{ actorId: string; input: Record<string, unknown> }>(req)
      const actorId = body.actorId || DEFAULT_ACTOR_IDS[body.actorId] || body.actorId
      const items = await runApifyScraper(token, actorId, body.input)
      return json(items)
    } catch (e) {
      return error(e instanceof Error ? e.message : "Scraper failed", 500)
    }
  }

  // ── Apify Token Management ───────────────────────────────────────────────
  if (path === "/api/apify/token" && method === "PUT") {
    try {
      const body = await getBody<{ token: string }>(req)
      if (!body.token?.trim()) return error("Token cannot be empty")

      // 1. Save to D1 (immediate availability)
      await env.DB.prepare(
        `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind("apify_token", body.token.trim(), new Date().toISOString()).run()

      // 2. Sync to Cloudflare secret (best-effort)
      const cfResult = await syncCFSecret(env, "APIFY_TOKEN", body.token.trim())

      return json({
        success: true,
        d1: true,
        cfSecret: cfResult.success,
        cfError: cfResult.error,
      })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to save token", 500)
    }
  }

  if (path === "/api/apify/token" && method === "DELETE") {
    try {
      // 1. Remove from D1
      await env.DB.prepare("DELETE FROM config WHERE key = ?").bind("apify_token").run()

      // 2. Remove from Cloudflare secrets (best-effort)
      const cfResult = await removeCFSecret(env, "APIFY_TOKEN")

      return json({
        success: true,
        d1: true,
        cfSecret: cfResult.success,
        cfError: cfResult.error,
      })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to remove token", 500)
    }
  }

  // ── Jobs Routes ─────────────────────────────────────────────────────────
  if (path === "/api/jobs" && method === "GET") {
    try {
      const result = await env.DB.prepare("SELECT * FROM jobs ORDER BY scraped_at DESC").all()
      return json(result.results)
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to fetch jobs", 500)
    }
  }

  if (path === "/api/jobs/append" && method === "POST") {
    try {
      const body = await getBody<{ jobs: Array<Record<string, string>> }>(req)
      const existing = await env.DB.prepare("SELECT job_id FROM jobs").all()
      const existingIds = new Set((existing.results as Array<{ job_id: string }>).map((r) => r.job_id))
      const newJobs = body.jobs.filter((j) => !existingIds.has(j.job_id))

      if (newJobs.length > 0) {
        const stmt = env.DB.prepare(
          `INSERT OR IGNORE INTO jobs (job_id, source_platform, title, company, location, job_type, experience_req, url, date_posted, scraped_at, application_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        const batch = newJobs.map((j) =>
          stmt.bind(j.job_id, j.source_platform, j.title, j.company, j.location || "", j.job_type || "Remote", j.experience_req || "", j.url || "", j.date_posted || "", j.scraped_at || "", j.application_status || "To Apply")
        )
        await env.DB.batch(batch)

        // Backup to Google Sheets
        if (env.GCP_SERVICE_ACCOUNT_KEY && env.GCP_SPREADSHEET_ID) {
          await backupJobsToSheets(env.GCP_SPREADSHEET_ID, env.GCP_SERVICE_ACCOUNT_KEY, newJobs)
        }
      }

      return json({ added: newJobs.length })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to append jobs", 500)
    }
  }

  if (path === "/api/jobs/status" && method === "PATCH") {
    try {
      const body = await getBody<{ jobId: string; status: string }>(req)
      await env.DB.prepare("UPDATE jobs SET application_status = ? WHERE job_id = ?").bind(body.status, body.jobId).run()

      // Backup status change to Sheets
      if (env.GCP_SERVICE_ACCOUNT_KEY && env.GCP_SPREADSHEET_ID) {
        try {
          const token = await getAccessToken(env.GCP_SERVICE_ACCOUNT_KEY)
          const res = await sheetsFetch(env.GCP_SPREADSHEET_ID, token, `/values/All_Jobs_Master!A:K?majorDimension=ROWS`)
          if (res.ok) {
            const data = (await res.json()) as { values?: string[][] }
            const rowIndex = (data.values || []).findIndex((row: string[]) => row[0] === body.jobId)
            if (rowIndex !== -1) {
              await sheetsFetch(env.GCP_SPREADSHEET_ID, token, `/values/All_Jobs_Master!K${rowIndex + 1}?valueInputOption=RAW`, {
                method: "PUT", body: JSON.stringify({ values: [[body.status]] }),
              })
            }
          }
        } catch { /* backup failure is non-critical */ }
      }

      return json({ success: true })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to update status", 500)
    }
  }

  // ── Posts Routes ────────────────────────────────────────────────────────
  if (path === "/api/posts" && method === "GET") {
    try {
      const result = await env.DB.prepare("SELECT * FROM linkedin_posts ORDER BY rowid DESC").all()
      return json(result.results)
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to fetch posts", 500)
    }
  }

  if (path === "/api/posts/append" && method === "POST") {
    try {
      const body = await getBody<{ posts: Array<Record<string, string>> }>(req)
      const existing = await env.DB.prepare("SELECT post_id FROM linkedin_posts").all()
      const existingIds = new Set((existing.results as Array<{ post_id: string }>).map((r) => r.post_id))
      const newPosts = body.posts.filter((p) => !existingIds.has(p.post_id))

      if (newPosts.length > 0) {
        const stmt = env.DB.prepare(
          `INSERT OR IGNORE INTO linkedin_posts (post_id, author_name, author_title, post_text, post_url, email, experience_req, detected_keywords, scraped_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        const batch = newPosts.map((p) =>
          stmt.bind(p.post_id, p.author_name || "", p.author_title || "", p.post_text || "", p.post_url || "", p.email || "", p.experience_req || "", p.detected_keywords || "", p.scraped_at || "", p.status || "Unread")
        )
        await env.DB.batch(batch)

        if (env.GCP_SERVICE_ACCOUNT_KEY && env.GCP_SPREADSHEET_ID) {
          await backupPostsToSheets(env.GCP_SPREADSHEET_ID, env.GCP_SERVICE_ACCOUNT_KEY, newPosts)
        }
      }

      return json({ added: newPosts.length })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to append posts", 500)
    }
  }

  if (path === "/api/posts/status" && method === "PATCH") {
    try {
      const body = await getBody<{ postId: string; status: string }>(req)
      await env.DB.prepare("UPDATE linkedin_posts SET status = ? WHERE post_id = ?").bind(body.status, body.postId).run()

      if (env.GCP_SERVICE_ACCOUNT_KEY && env.GCP_SPREADSHEET_ID) {
        try {
          const token = await getAccessToken(env.GCP_SERVICE_ACCOUNT_KEY)
          const res = await sheetsFetch(env.GCP_SPREADSHEET_ID, token, `/values/LinkedIn_Hiring_Posts!A:J?majorDimension=ROWS`)
          if (res.ok) {
            const data = (await res.json()) as { values?: string[][] }
            const rowIndex = (data.values || []).findIndex((row: string[]) => row[0] === body.postId)
            if (rowIndex !== -1) {
              await sheetsFetch(env.GCP_SPREADSHEET_ID, token, `/values/LinkedIn_Hiring_Posts!J${rowIndex + 1}?valueInputOption=RAW`, {
                method: "PUT", body: JSON.stringify({ values: [[body.status]] }),
              })
            }
          }
        } catch { /* backup failure is non-critical */ }
      }

      return json({ success: true })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to update status", 500)
    }
  }

  // ── Config Routes ───────────────────────────────────────────────────────
  if (path === "/api/config" && method === "GET") {
    try {
      const result = await env.DB.prepare("SELECT key, value FROM config").all()
      const config: Record<string, string> = {}
      for (const row of result.results as Array<{ key: string; value: string }>) {
        config[row.key] = row.value
      }
      // Merge with default actor IDs
      const actorIds = config.apify_actor_ids ? JSON.parse(config.apify_actor_ids) : {}
      // Get effective Apify token (D1 or env)
      const effectiveToken = await getApifyToken(env)
      const hasToken = !!effectiveToken
      // Check if CF_API_TOKEN is configured for secret management
      const canManageSecrets = !!(env.CF_API_TOKEN && env.CF_ACCOUNT_ID)
      return json({
        apify: {
          apiToken: hasToken ? "***" : "",
          hasToken,
          canManageSecrets,
          ...DEFAULT_ACTOR_IDS, ...actorIds
        },
        gcp: {
          serviceAccountKey: config.gcp_service_account_key || "",
          spreadsheetId: config.gcp_spreadsheet_id || "",
        },
      })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to fetch config", 500)
    }
  }

  if (path === "/api/config" && method === "PUT") {
    try {
      const body = await getBody<{ apify?: Record<string, string>; gcp?: Record<string, string> }>(req)
      const now = new Date().toISOString()

      if (body.apify) {
        const { apiToken: _, ...actorIds } = body.apify
        await env.DB.prepare(
          `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        ).bind("apify_actor_ids", JSON.stringify(actorIds), now).run()
      }

      if (body.gcp) {
        if (body.gcp.serviceAccountKey !== undefined) {
          await env.DB.prepare(
            `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind("gcp_service_account_key", body.gcp.serviceAccountKey, now).run()
        }
        if (body.gcp.spreadsheetId !== undefined) {
          await env.DB.prepare(
            `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind("gcp_spreadsheet_id", body.gcp.spreadsheetId, now).run()
        }
      }

      return json({ success: true })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to save config", 500)
    }
  }

  if (path === "/api/config/test-gcp" && method === "POST") {
    try {
      const body = await getBody<{ serviceAccountKey: string; spreadsheetId: string }>(req)
      const token = await getAccessToken(body.serviceAccountKey)
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${body.spreadsheetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) return json({ success: true })
      const err = await res.json() as { error?: { message?: string } }
      return json({ success: false, error: err.error?.message || "Failed to access spreadsheet" })
    } catch (e) {
      return json({ success: false, error: e instanceof Error ? e.message : "Connection failed" })
    }
  }

  // ── Filters Routes ──────────────────────────────────────────────────────
  if (path === "/api/filters" && method === "GET") {
    try {
      const result = await env.DB.prepare("SELECT * FROM filters ORDER BY created_at DESC").all()
      return json(
        (result.results as Array<{ id: string; name: string; data: string; created_at: string; updated_at: string }>).map((r) => ({
          id: r.id,
          name: r.name,
          ...JSON.parse(r.data),
          created_at: r.created_at,
          updated_at: r.updated_at,
        }))
      )
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to fetch filters", 500)
    }
  }

  if (path === "/api/filters" && method === "POST") {
    try {
      const body = await getBody<Record<string, unknown>>(req)
      const { id, name, created_at, updated_at, ...rest } = body
      await env.DB.prepare(
        `INSERT INTO filters (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at`
      ).bind(id as string, name as string, JSON.stringify(rest), (created_at as string) || "", (updated_at as string) || "").run()
      return json({ success: true })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to save filter", 500)
    }
  }

  if (path.startsWith("/api/filters/") && method === "DELETE") {
    const filterId = path.split("/")[3]
    try {
      await env.DB.prepare("DELETE FROM filters WHERE id = ?").bind(filterId).run()
      return json({ success: true })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to delete filter", 500)
    }
  }

  // ── Wipe Route ─────────────────────────────────────────────────────────
  if (path === "/api/wipe" && method === "POST") {
    try {
      await env.DB.exec("DELETE FROM jobs")
      await env.DB.exec("DELETE FROM linkedin_posts")

      if (env.GCP_SERVICE_ACCOUNT_KEY && env.GCP_SPREADSHEET_ID) {
        await wipeSheets(env.GCP_SPREADSHEET_ID, env.GCP_SERVICE_ACCOUNT_KEY)
      }

      return json({ success: true })
    } catch (e) {
      return error(e instanceof Error ? e.message : "Failed to wipe data", 500)
    }
  }

  return error("Not found", 404)
}

// ─── Main Worker Entry Point ────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    }

    // Route API requests to handler
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(url, request, env)
      } catch (e) {
        return error(e instanceof Error ? e.message : "Internal server error", 500)
      }
    }

    // Serve static assets (React SPA) — falls back to index.html for SPA routing
    return env.ASSETS.fetch(request)
  },
}
