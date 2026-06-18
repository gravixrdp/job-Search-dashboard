import { useState, useEffect } from "react"
import { CheckCircle2, XCircle, Loader2, Trash2, Eye, EyeOff, Key, Database, Cloud } from "lucide-react"
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
import { getConfig, updateApifyConfig, updateGCPConfig, clearConfig } from "@/services/config"
import { testApifyConnection } from "@/services/apify"
import { testGCPConnection, wipeAllData } from "@/services/google-sheets"

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

  useEffect(() => {
    setConfig(getConfig())
  }, [])

  async function handleTestApify() {
    if (!config.apify.apiToken) {
      toast.error("Please enter an Apify API token")
      return
    }
    setIsTestingApify(true)
    try {
      const result = await testApifyConnection(config.apify.apiToken)
      if (result.success) {
        setConnectionStatus((prev) => ({ ...prev, apify: "connected" }))
        toast.success("Apify connection successful!")
      } else {
        setConnectionStatus((prev) => ({ ...prev, apify: "error", error: result.error }))
        toast.error(`Apify connection failed: ${result.error}`)
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error"
      setConnectionStatus((prev) => ({ ...prev, apify: "error", error }))
      toast.error(`Apify connection failed: ${error}`)
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
      const result = await testGCPConnection(config.gcp)
      if (result.success) {
        setConnectionStatus((prev) => ({ ...prev, gcp: "connected" }))
        toast.success("Google Sheets connection successful!")
      } else {
        setConnectionStatus((prev) => ({ ...prev, gcp: "error", error: result.error }))
        toast.error(`GCP connection failed: ${result.error}`)
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error"
      setConnectionStatus((prev) => ({ ...prev, gcp: "error", error }))
      toast.error(`GCP connection failed: ${error}`)
    } finally {
      setIsTestingGCP(false)
    }
  }

  function handleSaveApifyConfig() {
    updateApifyConfig(config.apify)
    toast.success("Apify configuration saved")
  }

  function handleSaveGCPConfig() {
    updateGCPConfig(config.gcp)
    toast.success("GCP configuration saved")
  }

  async function handleWipeData() {
    try {
      await wipeAllData(config.gcp)
      toast.success("All data wiped from spreadsheet")
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error"
      toast.error(`Failed to wipe data: ${error}`)
    }
  }

  function handleClearAllConfig() {
    clearConfig()
    setConfig(getConfig())
    setConnectionStatus({ apify: "unknown", gcp: "unknown" })
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
                Configure your Apify API credentials and actor mappings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field>
            <FieldLabel>API Token</FieldLabel>
            <div className="relative">
              <Input
                type={showApifyToken ? "text" : "password"}
                value={config.apify.apiToken}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apify: { ...prev.apify, apiToken: e.target.value },
                  }))
                }
                placeholder="apify_api_xxxxxxxx"
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
              Get your API token from{" "}
              <a
                href="https://console.apify.com/account/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Apify Console
              </a>
            </FieldDescription>
          </Field>

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
                Configure Google Cloud Service Account for Google Sheets API access
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
                    This will permanently delete all job records and LinkedIn posts from your Google
                    Spreadsheet. This action cannot be undone.
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
                    This will remove all saved API keys and configuration from your browser. You'll
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
            Quick guide to get started with HuntSync AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <div>
                <strong>Create Apify Account:</strong> Sign up at{" "}
                <a
                  href="https://apify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  apify.com
                </a>{" "}
                and get your API token from the Integrations page.
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
                email (editor role).
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                4
              </div>
              <div>
                <strong>Configure & Test:</strong> Enter your credentials above, click Test
                Connection for both services. Once both are green, you're ready to scrape!
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
