import { useState, useEffect } from "react"
import { CheckCircle2, XCircle, Loader2, Trash2, Eye, EyeOff, Key, Database, Cloud, Save, ShieldCheck, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import type { AppConfig, ConnectionStatus } from "@/types"
import { getConfig, loadConfigFromServer, updateApifyConfig, updateGCPConfig, testGCPConnection, clearCachedConfig, saveApifyToken, removeApifyToken } from "@/services/config"
import { testApifyConnection } from "@/services/apify"
import { wipeAllData } from "@/services/google-sheets"

export function ConfigTab() {
  const [config, setConfig] = useState<AppConfig>(getConfig)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    apify: "unknown",
    gcp: "unknown",
  })
  const [isTestingApify, setIsTestingApify] = useState(false)
  const [isTestingGCP, setIsTestingGCP] = useState(false)
  const [showApifyToken, setShowApifyToken] = useState(false)
  const [showGCPKey, setShowGCPKey] = useState(false)
  const [apifyTokenInput, setApifyTokenInput] = useState("")
  const [isSavingToken, setIsSavingToken] = useState(false)
  const [isRemovingToken, setIsRemovingToken] = useState(false)
  const [tokenSyncStatus, setTokenSyncStatus] = useState<{ d1: boolean; cfSecret: boolean; cfError?: string } | null>(null)

  useEffect(() => {
    loadConfigFromServer().then((loaded) => setConfig(loaded))
  }, [])

  async function handleTestApify() {
    setIsTestingApify(true)
    try {
      const result = await testApifyConnection()
      if (result.success) {
        setConnectionStatus((prev) => ({ ...prev, apify: "connected" }))
        toast.success("Apify connection successful!")
      } else {
        setConnectionStatus((prev) => ({ ...prev, apify: "error", error: result.error }))
        toast.error(`Apify connection failed: ${result.error}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setConnectionStatus((prev) => ({ ...prev, apify: "error", error: msg }))
      toast.error(`Apify connection failed: ${msg}`)
    } finally {
      setIsTestingApify(false)
    }
  }

  async function handleTestGCP() {
    if (!config.gcp.serviceAccountKey || !config.gcp.spreadsheetId) {
      toast.error("Please enter GCP service account key and spreadsheet ID")
      return
    }
    setIsTestingGCP(true)
    try {
      const result = await testGCPConnection(config.gcp.serviceAccountKey, config.gcp.spreadsheetId)
      if (result.success) {
        setConnectionStatus((prev) => ({ ...prev, gcp: "connected" }))
        toast.success("Google Sheets connection successful!")
      } else {
        setConnectionStatus((prev) => ({ ...prev, gcp: "error", error: result.error }))
        toast.error(`GCP connection failed: ${result.error}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setConnectionStatus((prev) => ({ ...prev, gcp: "error", error: msg }))
      toast.error(`GCP connection failed: ${msg}`)
    } finally {
      setIsTestingGCP(false)
    }
  }

  async function handleSaveApifyToken() {
    if (!apifyTokenInput.trim()) {
      toast.error("Please enter an Apify API token")
      return
    }
    setIsSavingToken(true)
    setTokenSyncStatus(null)
    try {
      const result = await saveApifyToken(apifyTokenInput.trim())
      setTokenSyncStatus({ d1: result.d1, cfSecret: result.cfSecret, cfError: result.cfError })
      toast.success("Apify token saved successfully!")
      // Reload config to reflect hasToken
      const loaded = await loadConfigFromServer()
      setConfig(loaded)
      setApifyTokenInput("")
    } catch (e) {
      toast.error(`Failed to save token: ${e instanceof Error ? e.message : "Unknown error"}`)
    } finally {
      setIsSavingToken(false)
    }
  }

  async function handleRemoveApifyToken() {
    setIsRemovingToken(true)
    setTokenSyncStatus(null)
    try {
      const result = await removeApifyToken()
      setTokenSyncStatus({ d1: result.d1, cfSecret: result.cfSecret, cfError: result.cfError })
      toast.success("Apify token removed")
      const loaded = await loadConfigFromServer()
      setConfig(loaded)
      setConnectionStatus((prev) => ({ ...prev, apify: "unknown" }))
    } catch (e) {
      toast.error(`Failed to remove token: ${e instanceof Error ? e.message : "Unknown error"}`)
    } finally {
      setIsRemovingToken(false)
    }
  }

  async function handleSaveApifyConfig() {
    try {
      await updateApifyConfig(config.apify)
      toast.success("Apify configuration saved")
    } catch (e) {
      toast.error(`Failed to save: ${e instanceof Error ? e.message : "Unknown error"}`)
    }
  }

  async function handleSaveGCPConfig() {
    try {
      await updateGCPConfig(config.gcp)
      toast.success("GCP configuration saved")
    } catch (e) {
      toast.error(`Failed to save: ${e instanceof Error ? e.message : "Unknown error"}`)
    }
  }

  async function handleWipeData() {
    try {
      await wipeAllData()
      toast.success("All data wiped from database and spreadsheet")
    } catch (e) {
      toast.error(`Failed to wipe data: ${e instanceof Error ? e.message : "Unknown error"}`)
    }
  }

  function handleClearAllConfig() {
    clearCachedConfig()
    removeApifyToken().catch(() => {})
    updateApifyConfig({
      apiToken: "",
      linkedinActorId: "",
      indeedActorId: "",
      naukriActorId: "",
      glassdoorActorId: "",
      internshalaActorId: "",
      wellfoundActorId: "",
      founditActorId: "",
      hiristActorId: "",
      shineActorId: "",
      linkedinPostActorId: "",
    }).catch(() => {})
    updateGCPConfig({ serviceAccountKey: "", spreadsheetId: "" }).catch(() => {})
    loadConfigFromServer().then((loaded) => setConfig(loaded))
    setConnectionStatus({ apify: "unknown", gcp: "unknown" })
    setTokenSyncStatus(null)
    toast.success("All configuration cleared")
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Apify Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="size-5 text-muted-foreground" />
            <div>
              <CardTitle>Apify API Engine</CardTitle>
              <CardDescription>
                Manage your Apify API token and actor mappings. Token is saved to D1 and synced to Cloudflare Secrets.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Apify Token Management */}
          <Field>
            <FieldLabel className="flex items-center gap-2">
              API Token
              {config.apify.hasToken ? (
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0">
                  <ShieldCheck className="size-3 mr-1" /> Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  <ShieldAlert className="size-3 mr-1" /> Not Set
                </Badge>
              )}
            </FieldLabel>
            <div className="relative">
              <Input
                type={showApifyToken ? "text" : "password"}
                value={apifyTokenInput}
                onChange={(e) => setApifyTokenInput(e.target.value)}
                placeholder={config.apify.hasToken ? "Enter new token to update existing one" : "Paste your Apify API token here"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApifyToken(!showApifyToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApifyToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <FieldDescription>
              Token is saved to D1 (instant) and synced to Cloudflare Worker Secrets.
              Get your token from{" "}
              <a
                href="https://console.apify.com/account/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Apify Console
              </a>.
              {config.apify.hasToken && " Your current token is stored securely and not visible here."}
            </FieldDescription>
          </Field>

          {/* Token Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveApifyToken}
              disabled={isSavingToken || !apifyTokenInput.trim()}
            >
              {isSavingToken ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
              Save Token
            </Button>
            {config.apify.hasToken && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRemoveApifyToken}
                disabled={isRemovingToken}
                className="text-destructive"
              >
                {isRemovingToken ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Trash2 className="size-4 mr-1.5" />}
                Remove Token
              </Button>
            )}

            {/* Sync Status */}
            {tokenSyncStatus && (
              <div className="flex items-center gap-2 ml-2 text-xs">
                <span className="flex items-center gap-1">
                  {tokenSyncStatus.d1 ? (
                    <CheckCircle2 className="size-3 text-green-600" />
                  ) : (
                    <XCircle className="size-3 text-destructive" />
                  )}
                  D1
                </span>
                <span className="flex items-center gap-1">
                  {tokenSyncStatus.cfSecret ? (
                    <CheckCircle2 className="size-3 text-green-600" />
                  ) : (
                    <XCircle className="size-3 text-amber-500" />
                  )}
                  CF Secret
                </span>
                {tokenSyncStatus.cfError && (
                  <span className="text-amber-500 truncate max-w-[200px]" title={tokenSyncStatus.cfError}>
                    ({tokenSyncStatus.cfError})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actor ID Mapping */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>LinkedIn Jobs Actor ID</FieldLabel>
              <Input
                value={config.apify.linkedinActorId}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apify: { ...prev.apify, linkedinActorId: e.target.value },
                  }))
                }
                placeholder="apify/linkedin-jobs-scraper"
              />
            </Field>
            <Field>
              <FieldLabel>Indeed Actor ID</FieldLabel>
              <Input
                value={config.apify.indeedActorId}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apify: { ...prev.apify, indeedActorId: e.target.value },
                  }))
                }
                placeholder="apify/indeed-scraper"
              />
            </Field>
            <Field>
              <FieldLabel>Wellfound Actor ID</FieldLabel>
              <Input
                value={config.apify.wellfoundActorId}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apify: { ...prev.apify, wellfoundActorId: e.target.value },
                  }))
                }
                placeholder="apify/wellfound-jobs-scraper"
              />
            </Field>
            <Field>
              <FieldLabel>Naukri Actor ID</FieldLabel>
              <Input
                value={config.apify.naukriActorId}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apify: { ...prev.apify, naukriActorId: e.target.value },
                  }))
                }
                placeholder="apify/naukri-scraper"
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel>LinkedIn Post Scraper Actor ID</FieldLabel>
              <Input
                value={config.apify.linkedinPostActorId}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apify: { ...prev.apify, linkedinPostActorId: e.target.value },
                  }))
                }
                placeholder="apify/linkedin-post-scraper"
              />
            </Field>
          </div>

          {/* Connection Status & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  connectionStatus.apify === "connected"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : connectionStatus.apify === "error"
                      ? "bg-destructive/10 text-destructive"
                      : ""
                }
              >
                {connectionStatus.apify === "connected" ? (
                  <CheckCircle2 className="size-3 mr-1" />
                ) : connectionStatus.apify === "error" ? (
                  <XCircle className="size-3 mr-1" />
                ) : null}
                {connectionStatus.apify === "connected"
                  ? "Connected"
                  : connectionStatus.apify === "error"
                    ? "Error"
                    : "Not Tested"}
              </Badge>
              {connectionStatus.error && (
                <span className="text-xs text-destructive">{connectionStatus.error}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTestApify} disabled={isTestingApify}>
                {isTestingApify ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : null}
                Test Connection
              </Button>
              <Button onClick={handleSaveApifyConfig}>Save Config</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GCP Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="size-5 text-muted-foreground" />
            <div>
              <CardTitle>GCP Security Engine</CardTitle>
              <CardDescription>
                Configure Google Cloud Service Account for Google Sheets backup sync
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field>
            <FieldLabel>Service Account JSON Key</FieldLabel>
            <div className="relative">
              <Textarea
                value={config.gcp.serviceAccountKey}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    gcp: { ...prev.gcp, serviceAccountKey: e.target.value },
                  }))
                }
                placeholder={`{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  "client_email": "..."\n}`}
                className={`font-mono text-xs min-h-[150px] ${showGCPKey ? "" : "blur-sm select-none"}`}
              />
              <button
                type="button"
                onClick={() => setShowGCPKey(!showGCPKey)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showGCPKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <FieldDescription>
              Paste the contents of your GCP Service Account JSON key file. Keep this secure!
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Google Spreadsheet ID</FieldLabel>
            <Input
              value={config.gcp.spreadsheetId}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  gcp: { ...prev.gcp, spreadsheetId: e.target.value },
                }))
              }
              placeholder="1BxiMVs0XRA5n8d0K7m..."
            />
            <FieldDescription>
              Found in your spreadsheet URL: docs.google.com/spreadsheets/d/
              <strong>SPREADSHEET_ID</strong>/edit
            </FieldDescription>
          </Field>

          {/* Connection Status & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  connectionStatus.gcp === "connected"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : connectionStatus.gcp === "error"
                      ? "bg-destructive/10 text-destructive"
                      : ""
                }
              >
                {connectionStatus.gcp === "connected" ? (
                  <CheckCircle2 className="size-3 mr-1" />
                ) : connectionStatus.gcp === "error" ? (
                  <XCircle className="size-3 mr-1" />
                ) : null}
                {connectionStatus.gcp === "connected"
                  ? "Connected"
                  : connectionStatus.gcp === "error"
                    ? "Error"
                    : "Not Tested"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTestGCP} disabled={isTestingGCP}>
                {isTestingGCP ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : null}
                Test Connection
              </Button>
              <Button onClick={handleSaveGCPConfig}>Save Config</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Control Center */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="size-5 text-destructive" />
            <div>
              <CardTitle>Control Center</CardTitle>
              <CardDescription>
                Destructive operations - use with caution
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="size-4 mr-2" />
                  Wipe Database
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all job records and LinkedIn posts from your Cloudflare D1
                    database and Google Spreadsheet backup. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleWipeData}>Delete All Data</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Trash2 className="size-4 mr-2" />
                  Clear All Config
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all configuration?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all saved API keys and configuration from the database. You will
                    need to re-enter everything.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAllConfig}>
                    Clear Config
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            Quick guide to get started with HuntSync AI on Cloudflare
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <div>
                <strong>Set Apify Token:</strong> Paste your Apify API token above and click{" "}
                <strong>Save Token</strong>. Get your token from{" "}
                <a
                  href="https://console.apify.com/account/integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Apify Console
                </a>.
                The token is stored in D1 and synced to Cloudflare Secrets automatically.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <div>
                <strong>Create GCP Service Account:</strong> Go to Google Cloud Console, create a
                Service Account, and download the JSON key. Enable Google Sheets API.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </div>
              <div>
                <strong>Create Google Spreadsheet:</strong> Create a new spreadsheet with two sheets:
                "All_Jobs_Master" and "LinkedIn_Hiring_Posts". Share it with your Service Account
                email (editor role). Paste the JSON key and Spreadsheet ID above.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                4
              </div>
              <div>
                <strong>Test Connections:</strong> Click "Test Connection" for both services above.
                Once both are green, you are ready to scrape!
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
