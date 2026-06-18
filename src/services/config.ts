// Configuration Store - Server-side (D1) with local memory cache

import type { AppConfig, ApifyConfig, GCPConfig } from "@/types"

const defaultApifyConfig: ApifyConfig = {
  apiToken: "",
  linkedinActorId: "curious_coder/linkedin-jobs-scraper",
  indeedActorId: "misceres/indeed-scraper",
  naukriActorId: "accurate_workstation/naukri-jobs-scraper-free",
  glassdoorActorId: "fatihai-tools/glassdoor-jobs",
  internshalaActorId: "unfenced-group/internshala-scraper",
  wellfoundActorId: "blackfalcondata/wellfound-scraper",
  founditActorId: "codingfrontend/foundit-jobs-scraper",
  hiristActorId: "logiover/hirist-tech-scraper",
  shineActorId: "unfenced-group/shine-scraper",
  linkedinPostActorId: "apify/linkedin-post-scraper",
}

const defaultGCPConfig: GCPConfig = {
  serviceAccountKey: "",
  spreadsheetId: "",
}

// Local memory cache
let cachedConfig: AppConfig | null = null

export function getConfig(): AppConfig {
  if (cachedConfig) return { ...cachedConfig }
  return {
    apify: { ...defaultApifyConfig },
    gcp: { ...defaultGCPConfig },
  }
}

export async function loadConfigFromServer(): Promise<AppConfig> {
  try {
    const response = await fetch("/api/config")
    if (!response.ok) throw new Error("Failed to load config")
    const data = await response.json() as {
      apify: Record<string, string>
      gcp: { serviceAccountKey: string; spreadsheetId: string }
    }

    const config: AppConfig = {
      apify: { ...defaultApifyConfig, ...data.apify },
      gcp: { ...defaultGCPConfig, ...data.gcp },
    }

    cachedConfig = config
    return config
  } catch (e) {
    console.error("Failed to load config from server:", e)
    return getConfig()
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apify: config.apify,
      gcp: config.gcp,
    }),
  })

  if (!response.ok) throw new Error("Failed to save config")
  cachedConfig = config
}

export async function updateApifyConfig(updates: Partial<ApifyConfig>): Promise<ApifyConfig> {
  const config = getConfig()
  const newApifyConfig = { ...config.apify, ...updates }
  await saveConfig({ ...config, apify: newApifyConfig })
  return newApifyConfig
}

export async function updateGCPConfig(updates: Partial<GCPConfig>): Promise<GCPConfig> {
  const config = getConfig()
  const newGCPConfig = { ...config.gcp, ...updates }
  await saveConfig({ ...config, gcp: newGCPConfig })
  return newGCPConfig
}

export async function testGCPConnection(serviceAccountKey: string, spreadsheetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/config/test-gcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceAccountKey, spreadsheetId }),
    })
    return (await response.json()) as { success: boolean; error?: string }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Connection failed" }
  }
}

export function clearCachedConfig(): void {
  cachedConfig = null
}

// ─── Apify Token Management ────────────────────────────────────────────────

export async function saveApifyToken(token: string): Promise<{
  success: boolean
  d1: boolean
  cfSecret: boolean
  cfError?: string
}> {
  const response = await fetch("/api/apify/token", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  if (!response.ok) {
    const err = await response.json() as { error?: string }
    throw new Error(err.error || "Failed to save token")
  }
  // Clear cache so next load reflects the change
  cachedConfig = null
  return (await response.json()) as { success: boolean; d1: boolean; cfSecret: boolean; cfError?: string }
}

export async function removeApifyToken(): Promise<{
  success: boolean
  d1: boolean
  cfSecret: boolean
  cfError?: string
}> {
  const response = await fetch("/api/apify/token", { method: "DELETE" })
  if (!response.ok) {
    const err = await response.json() as { error?: string }
    throw new Error(err.error || "Failed to remove token")
  }
  cachedConfig = null
  return (await response.json()) as { success: boolean; d1: boolean; cfSecret: boolean; cfError?: string }
}
