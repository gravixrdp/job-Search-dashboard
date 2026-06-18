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
