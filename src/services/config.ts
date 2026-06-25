// Configuration Store - Server-side (D1) with local memory cache

import type { AppConfig, ApifyConfig, GCPConfig, MailbotConfig } from "@/types"

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
  linkedinPostActorId: "harvestapi/linkedin-post-search",
}

const defaultGCPConfig: GCPConfig = {
  serviceAccountKey: "",
  spreadsheetId: "",
}

export const defaultEmailTemplate = `<html><body style="font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.6;">

<p>Dear Hiring Team,</p>

<p>
I am <strong>Vishal Gurjar</strong>, a <strong>DevOps &amp; Cloud Engineer</strong>
(B.E. Computer Engineering, graduating June 2026) from Ahmedabad, applying for a
<strong>DevOps Engineer role</strong> at <strong>{company}</strong>.
</p>

<p>I have <strong>6 months of internship experience</strong> across <strong>GCP</strong> and <strong>AWS</strong>:</p>

<ul>
  <li>Built end-to-end <strong>GCP CI/CD pipeline</strong> using <strong>Cloud Build</strong>,
      <strong>Artifact Registry</strong>, and <strong>Cloud Run</strong> with Cloud SQL,
      eliminating <strong>100%</strong> of manual deployments.</li>

  <li>Architected the <strong>GKE platform</strong> with <strong>Workload Identity Federation</strong>
      and <strong>ArgoCD GitOps</strong>, enabling <strong>sub-5-minute rollbacks</strong>.</li>

  <li>Developed <strong>Apigee X proxies</strong> using <strong>Vertex AI Vector Search</strong>
      for LLM semantic caching and <strong>Cloud DLP</strong> for PII masking.</li>

  <li>Managed <strong>8+ AWS services</strong> (EC2, VPC, S3, ECS, IAM, CloudWatch)
      maintaining <strong>99.9% uptime</strong>.</li>

  <li>Automated operations via <strong>Shell scripting</strong>, reducing manual effort by
      <strong>80%</strong>.</li>
</ul>

<p>
<strong>Core Skills:</strong> Linux | Docker | Kubernetes | Terraform | Jenkins |
GitHub Actions | SonarQube | Trivy | Prometheus | Grafana
</p>

<p>
<strong>Certification:</strong> Oracle Cloud Infrastructure 2025 Certified DevOps Professional
</p>

<p>
Resume is attached for your review.&nbsp;
<strong>Portfolio:</strong> <a href="https://gurjar-vishal.me">gurjar-vishal.me</a> |
<strong>GitHub:</strong> <a href="https://github.com/gurjar-vishal">github.com/gurjar-vishal</a>
</p>

<p>Thank you for your time. I would be happy to connect at your convenience.</p>

<p>
Regards,<br/>
<strong>Vishal Gurjar</strong><br/>
+91 9909083139 | vishalgurjar0444@gmail.com<br/>
<a href="https://linkedin.com/in/vg-ahir-444-devops">linkedin.com/in/vg-ahir-444-devops</a>
</p>

</body></html>`;

export const defaultMailbotConfig: MailbotConfig = {
  gmailUser: "",
  gmailPass: "",
  emailSubject: "Application for DevOps Engineer Role | Vishal Gurjar | GCP | AWS | Kubernetes | Terraform | CI/CD",
  emailTemplate: defaultEmailTemplate,
}

// Local memory cache
let cachedConfig: AppConfig | null = null

export function getConfig(): AppConfig {
  if (cachedConfig) return { ...cachedConfig }
  return {
    apify: { ...defaultApifyConfig },
    gcp: { ...defaultGCPConfig },
    mailbot: { ...defaultMailbotConfig },
  }
}

export async function loadConfigFromServer(): Promise<AppConfig> {
  try {
    const response = await fetch("/api/config")
    if (!response.ok) throw new Error("Failed to load config")
    const data = await response.json() as {
      apify: Record<string, string>
      gcp: { serviceAccountKey: string; spreadsheetId: string }
      mailbot: Record<string, string>
    }

    const config: AppConfig = {
      apify: { ...defaultApifyConfig, ...data.apify },
      gcp: { ...defaultGCPConfig, ...data.gcp },
      mailbot: { ...defaultMailbotConfig, ...data.mailbot },
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
      mailbot: config.mailbot,
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

export async function updateMailbotConfig(updates: Partial<MailbotConfig>): Promise<MailbotConfig> {
  const config = getConfig()
  const newMailbotConfig = { ...config.mailbot, ...updates }
  await saveConfig({ ...config, mailbot: newMailbotConfig })
  return newMailbotConfig
}

export async function uploadResume(name: string, base64Data: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/mailbot/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, base64Data }),
    })
    return (await response.json()) as { success: boolean; error?: string }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to upload resume" }
  }
}

export async function getResumeInfo(): Promise<{ name: string; size: number; hasResume: boolean }> {
  try {
    const response = await fetch("/api/mailbot/resume")
    if (!response.ok) throw new Error("Failed to get resume info")
    return (await response.json()) as { name: string; size: number; hasResume: boolean }
  } catch (e) {
    console.error("Failed to fetch resume metadata:", e)
    return { name: "", size: 0, hasResume: false }
  }
}

export async function sendApplicationEmail(to: string, company: string, subject: string, body: string, force?: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/mailbot/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, company, subject, body, force }),
    })
    return (await response.json()) as { success: boolean; error?: string }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to send email" }
  }
}

export async function getSentLog(): Promise<{ entries: import("@/types").SentLogEntry[] }> {
  try {
    const response = await fetch("/api/mailbot/sent-log")
    if (!response.ok) throw new Error("Failed to load sent log")
    return (await response.json()) as { entries: import("@/types").SentLogEntry[] }
  } catch (e) {
    console.error("Failed to fetch sent log:", e)
    return { entries: [] }
  }
}

export async function clearSentLog(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/mailbot/sent-log", { method: "DELETE" })
    return (await response.json()) as { success: boolean; error?: string }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to clear log" }
  }
}

export async function deleteFromSentLog(domain: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/mailbot/sent-log?domain=${encodeURIComponent(domain)}`, { method: "DELETE" })
    return (await response.json()) as { success: boolean; error?: string }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to delete entry" }
  }
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
