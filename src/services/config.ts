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
// Configuration Store - Manages API keys and settings in localStorage

import type { AppConfig, ApifyConfig, GCPConfig } from "@/types"

const STORAGE_KEY = "huntsync_config"

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

export function getConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        apify: { ...defaultApifyConfig, ...parsed.apify },
        gcp: { ...defaultGCPConfig, ...parsed.gcp },
      }
    }
  } catch (e) {
    console.error("Failed to parse config:", e)
  }
  return {
    apify: defaultApifyConfig,
    gcp: defaultGCPConfig,
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function updateApifyConfig(updates: Partial<ApifyConfig>): ApifyConfig {
  const config = getConfig()
  const newApifyConfig = { ...config.apify, ...updates }
  saveConfig({ ...config, apify: newApifyConfig })
  return newApifyConfig
}

export function updateGCPConfig(updates: Partial<GCPConfig>): GCPConfig {
  const config = getConfig()
  const newGCPConfig = { ...config.gcp, ...updates }
  saveConfig({ ...config, gcp: newGCPConfig })
  return newGCPConfig
}

export function clearConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}
