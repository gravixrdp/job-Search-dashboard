import { useState, useEffect } from "react"
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, Save, Bot, Send, Mail, ShieldCheck, ShieldAlert, Sparkles, RefreshCw, Key, Upload, FileText } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

import type { MailbotConfig } from "@/types"
import { getConfig, loadConfigFromServer, updateMailbotConfig, testTelegramConnection, testIMAPConnection, uploadResume, getResumeInfo } from "@/services/config"

export function MailbotTab() {
  const [config, setConfig] = useState<MailbotConfig>(getConfig().mailbot)
  const [isLoading, setIsLoading] = useState(true)
  
  // Form states
  const [telegramBotToken, setTelegramBotToken] = useState("")
  const [telegramChatId, setTelegramChatId] = useState("")
  const [imapHost, setImapHost] = useState("")
  const [imapPort, setImapPort] = useState("993")
  const [imapUser, setImapUser] = useState("")
  const [imapPassword, setImapPassword] = useState("")
  const [forwardFilter, setForwardFilter] = useState("")
  const [checkInterval, setCheckInterval] = useState("5")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailTemplate, setEmailTemplate] = useState("")

  // Resume states
  const [resumeInfo, setResumeInfo] = useState<{ name: string; size: number; hasResume: boolean } | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Visibility states
  const [showToken, setShowToken] = useState(false)
  const [showImapPassword, setShowImapPassword] = useState(false)

  // Testing & Saving states
  const [isTestingTelegram, setIsTestingTelegram] = useState(false)
  const [isTestingImap, setIsTestingImap] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Connection Results
  const [telegramTestStatus, setTelegramTestStatus] = useState<"idle" | "success" | "error">("idle")
  const [telegramError, setTelegramError] = useState("")
  const [imapTestStatus, setImapTestStatus] = useState<"idle" | "success" | "error">("idle")
  const [imapError, setImapError] = useState("")

  const loadResumeMetadata = async () => {
    const info = await getResumeInfo()
    setResumeInfo(info)
  }

  useEffect(() => {
    Promise.all([
      loadConfigFromServer(),
      getResumeInfo()
    ]).then(([loaded, resume]) => {
      const mailbot = loaded.mailbot
      setConfig(mailbot)
      setTelegramBotToken(mailbot.telegramBotToken || "")
      setTelegramChatId(mailbot.telegramChatId || "")
      setImapHost(mailbot.imapHost || "")
      setImapPort(mailbot.imapPort || "993")
      setImapUser(mailbot.imapUser || "")
      setImapPassword(mailbot.imapPassword || "")
      setForwardFilter(mailbot.forwardFilter || "")
      setCheckInterval(mailbot.checkInterval || "5")
      setEmailSubject(mailbot.emailSubject || "")
      setEmailTemplate(mailbot.emailTemplate || "")
      setResumeInfo(resume)
      setIsLoading(false)
    })
  }, [])

  async function handleTestTelegram() {
    if (!telegramBotToken || !telegramChatId) {
      toast.error("Please fill in Telegram Bot Token and Chat ID to run a connection test.")
      return
    }
    setIsTestingTelegram(true)
    setTelegramTestStatus("idle")
    setTelegramError("")

    try {
      const result = await testTelegramConnection(telegramBotToken, telegramChatId)
      if (result.success) {
        setTelegramTestStatus("success")
        toast.success("Telegram test message sent successfully! Check your bot chat.")
      } else {
        setTelegramTestStatus("error")
        setTelegramError(result.error || "Connection failed")
        toast.error(`Telegram connection failed: ${result.error}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setTelegramTestStatus("error")
      setTelegramError(msg)
      toast.error(`Telegram connection failed: ${msg}`)
    } finally {
      setIsTestingTelegram(false)
    }
  }

  async function handleTestImap() {
    if (!imapHost || !imapPort) {
      toast.error("Please configure IMAP Host and Port to run a connection test.")
      return
    }
    setIsTestingImap(true)
    setImapTestStatus("idle")
    setImapError("")

    try {
      const result = await testIMAPConnection(imapHost, imapPort)
      if (result.success) {
        setImapTestStatus("success")
        toast.success("IMAP TCP connection verified successfully!")
      } else {
        setImapTestStatus("error")
        setImapError(result.error || "Connection failed")
        toast.error(`IMAP connection failed: ${result.error}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setImapTestStatus("error")
      setImapError(msg)
      toast.error(`IMAP connection failed: ${msg}`)
    } finally {
      setIsTestingImap(false)
    }
  }

  async function handleSaveSettings() {
    setIsSaving(true)
    try {
      const updates: MailbotConfig = {
        telegramBotToken,
        telegramChatId,
        imapHost,
        imapPort,
        imapUser,
        imapPassword,
        forwardFilter,
        checkInterval,
        emailSubject,
        emailTemplate,
      }
      const saved = await updateMailbotConfig(updates)
      setConfig(saved)
      // Retain masked values returned from server
      setTelegramBotToken(saved.telegramBotToken || "")
      setImapPassword(saved.imapPassword || "")
      toast.success("Mailbot configurations saved successfully!")
    } catch (e) {
      toast.error(`Failed to save settings: ${e instanceof Error ? e.message : "Unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file only.")
      return
    }

    setIsUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64String = (reader.result as string).split(",")[1]
        const res = await uploadResume(file.name, base64String)
        if (res.success) {
          toast.success("Resume PDF uploaded successfully!")
          await loadResumeMetadata()
        } else {
          toast.error(`Upload failed: ${res.error}`)
        }
      }
      reader.onerror = () => {
        toast.error("Error reading file.")
      }
      reader.readAsDataURL(file)
    } catch (err) {
      toast.error("Upload process encountered an error.")
    } finally {
      setIsUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading configurations...</span>
      </div>
    )
  }

  const isTelegramConfigured = config.telegramBotToken && config.telegramBotToken !== ""
  const isImapConfigured = config.imapHost && config.imapHost !== ""

  return (
    <div className="grid gap-6 lg:grid-cols-3 max-w-6xl">
      {/* Configuration Forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Telegram Configuration Card */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Send className="size-4.5" />
                </div>
                <div>
                  <CardTitle>Telegram Bot Connection</CardTitle>
                  <CardDescription>
                    Configure credentials to allow Mailbot to forward email digests directly to your Telegram chat.
                  </CardDescription>
                </div>
              </div>
              <div>
                {isTelegramConfigured ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 px-2.5 py-0.5">
                    <ShieldCheck className="size-3.5" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5 px-2.5 py-0.5">
                    <ShieldAlert className="size-3.5" /> Unconfigured
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Bot API Token</FieldLabel>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder={config.telegramBotToken ? "••••••••••••••••••••••••••••••••" : "Enter Telegram Bot Token"}
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <FieldDescription>Issued by @BotFather during bot creation.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Target Chat ID</FieldLabel>
                <Input
                  type="text"
                  placeholder="e.g. 523910392 or -10012838123"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                />
                <FieldDescription>Telegram Chat or Channel ID where alerts will be sent.</FieldDescription>
              </Field>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="text-xs text-muted-foreground">
                {telegramTestStatus === "success" && (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Test sent! Verify your Telegram app.
                  </span>
                )}
                {telegramTestStatus === "error" && (
                  <span className="text-destructive flex items-center gap-1 font-medium max-w-xs truncate" title={telegramError}>
                    <XCircle className="size-3.5" /> Error: {telegramError}
                  </span>
                )}
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleTestTelegram}
                disabled={isTestingTelegram}
                className="gap-1.5"
              >
                {isTestingTelegram ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Testing...
                  </>
                ) : (
                  <>
                    <Bot className="size-3.5" /> Test Connection
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* IMAP Configuration Card */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Mail className="size-4.5" />
                </div>
                <div>
                  <CardTitle>IMAP Mail Server Connection</CardTitle>
                  <CardDescription>
                    Configure the IMAP inbox for Mailbot to listen for inbound email job notifications.
                  </CardDescription>
                </div>
              </div>
              <div>
                {isImapConfigured ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 px-2.5 py-0.5">
                    <ShieldCheck className="size-3.5" /> Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5 px-2.5 py-0.5">
                    <ShieldAlert className="size-3.5" /> Unconfigured
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field className="sm:col-span-2">
                <FieldLabel>IMAP Host</FieldLabel>
                <Input
                  type="text"
                  placeholder="e.g. imap.gmail.com"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>IMAP Port</FieldLabel>
                <Input
                  type="text"
                  placeholder="e.g. 993"
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Email Address / Username</FieldLabel>
                <Input
                  type="email"
                  placeholder="your-email@gmail.com"
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Password / App Key</FieldLabel>
                <div className="relative">
                  <Input
                    type={showImapPassword ? "text" : "password"}
                    placeholder={config.imapPassword ? "••••••••••••••••" : "Enter IMAP App Password"}
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowImapPassword(!showImapPassword)}
                  >
                    {showImapPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <FieldDescription>For Gmail, generate and use a secure 16-character App Password.</FieldDescription>
              </Field>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="text-xs text-muted-foreground">
                {imapTestStatus === "success" && (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Socket check verified! Host is reachable.
                  </span>
                )}
                {imapTestStatus === "error" && (
                  <span className="text-destructive flex items-center gap-1 font-medium max-w-xs truncate" title={imapError}>
                    <XCircle className="size-3.5" /> Socket connection failed: {imapError}
                  </span>
                )}
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleTestImap}
                disabled={isTestingImap}
                className="gap-1.5"
              >
                {isTestingImap ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Connection check...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3.5" /> Test Connection
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PDF Resume Uploader Card */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                <FileText className="size-4.5" />
              </div>
              <div>
                <CardTitle>Application Resume PDF</CardTitle>
                <CardDescription>
                  Upload your primary resume. This PDF will automatically be attached to all dashboard emails.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-dashed border-border/60 rounded-xl bg-muted/20">
              <div className="flex-1 space-y-1">
                {resumeInfo?.hasResume ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20">Attached</Badge>
                    <span className="font-semibold text-sm max-w-[200px] truncate">{resumeInfo.name}</span>
                    <span className="text-xs text-muted-foreground">({(resumeInfo.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="text-sm text-amber-500 font-medium">No Resume PDF Attached</div>
                )}
                <div className="text-xs text-muted-foreground">Accepts PDF format only, max size 10MB.</div>
              </div>
              
              <div className="relative">
                <input
                  type="file"
                  id="resume-file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button asChild variant="outline" className="cursor-pointer gap-2" disabled={isUploading}>
                  <label htmlFor="resume-file">
                    {isUploading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" /> Upload Resume PDF
                      </>
                    )}
                  </label>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Templates Editor Card */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                <Sparkles className="size-4.5" />
              </div>
              <div>
                <CardTitle>Job Application Template</CardTitle>
                <CardDescription>
                  Configure the default HTML structure and subject line for candidate submissions.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel>Subject Line Template</FieldLabel>
              <Input
                type="text"
                placeholder="e.g. DevOps Role Application | {name}"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>HTML Template Body (use <code>{"{company}"}</code> to dynamic swap)</FieldLabel>
              <Textarea
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="min-h-[300px] font-mono text-xs leading-relaxed"
                placeholder="Write your email HTML body here"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Sync Preferences & Filters */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                <Key className="size-4.5" />
              </div>
              <div>
                <CardTitle>Tuning & Sync Preferences</CardTitle>
                <CardDescription>
                  Adjust check frequencies and email matching filters to control what alerts are generated.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Sync Interval (Minutes)</FieldLabel>
                <Input
                  type="number"
                  placeholder="5"
                  value={checkInterval}
                  onChange={(e) => setCheckInterval(e.target.value)}
                  min="1"
                />
                <FieldDescription>How frequently the Telegram daemon queries the mailbox.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Keywords Filter (RegEx / Text)</FieldLabel>
                <Input
                  type="text"
                  placeholder="e.g. hiring|opportunity|job"
                  value={forwardFilter}
                  onChange={(e) => setForwardFilter(e.target.value)}
                />
                <FieldDescription>Regex pattern. Only match emails containing these words (leave empty for all).</FieldDescription>
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Global actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button 
            onClick={handleSaveSettings} 
            disabled={isSaving}
            className="w-full sm:w-auto px-6 gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="size-4" /> Save Configurations
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Visual Live Preview Widget */}
      <div className="space-y-6">
        <Card className="border border-border/40 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 backdrop-blur-md h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2 text-indigo-500">
              <Sparkles className="size-4.5" />
              <CardTitle className="text-base font-semibold">Active Preview</CardTitle>
            </div>
            <CardDescription>
              A visual mockup of the incoming Telegram notifications sent from your mailbot client.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center p-4">
            
            {/* Telegram Chat Simulation */}
            <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-2xl overflow-hidden font-sans">
              
              {/* Tele Header */}
              <div className="bg-neutral-800/80 px-4 py-3 flex items-center gap-3 border-b border-neutral-700/50">
                <div className="size-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-sm">
                  MB
                </div>
                <div>
                  <div className="text-xs font-semibold text-white leading-tight">Mailbot 🤖</div>
                  <div className="text-[10px] text-blue-400">bot</div>
                </div>
              </div>

              {/* Chat Canvas */}
              <div className="p-4 bg-[#141414] min-h-[220px] flex flex-col justify-end gap-4 text-xs">
                
                {/* System Message */}
                <div className="mx-auto bg-neutral-800/40 text-neutral-400 text-[10px] px-2.5 py-1 rounded-full text-center">
                  Today
                </div>

                {/* Bot Message Bubble */}
                <div className="bg-neutral-800 text-neutral-100 rounded-2xl rounded-tl-none p-3 max-w-[85%] border border-neutral-700/30 flex flex-col gap-2.5 relative">
                  
                  <div>
                    <span className="font-semibold text-blue-400">✉️ New Job Match Detected!</span>
                  </div>
                  
                  <div className="space-y-1 text-[11px] leading-relaxed text-neutral-300">
                    <p><span className="text-neutral-400 font-medium">From:</span> hr@techcorp.io</p>
                    <p><span className="text-neutral-400 font-medium">Subject:</span> Recruiting: Lead Cloud Engineer</p>
                    <p className="mt-1.5 border-t border-neutral-700/60 pt-1.5">
                      "Hey, we noticed your profile under the tags {forwardFilter ? <code className="bg-neutral-900 px-1 py-0.2 rounded text-blue-400 font-semibold">{forwardFilter}</code> : <code className="bg-neutral-900 px-1 py-0.2 rounded text-blue-400 font-semibold">DevOps</code>} and wanted to schedule an initial interview call..."
                    </p>
                  </div>

                  {/* Bubble action buttons */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div className="bg-neutral-900 text-neutral-200 border border-neutral-700 rounded-lg py-1 px-2 text-center text-[10px] font-medium hover:bg-neutral-800 cursor-pointer transition">
                      📁 Open Details
                    </div>
                    <div className="bg-neutral-950 text-neutral-400 border border-neutral-700/50 rounded-lg py-1 px-2 text-center text-[10px] font-medium hover:bg-neutral-900 cursor-pointer transition">
                      ❌ Ignore
                    </div>
                  </div>
                  
                  <span className="text-[9px] text-neutral-500 self-end">11:34 AM</span>
                </div>

              </div>

            </div>
            
            <div className="mt-4 text-center max-w-xs">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Matches are highlighted and filtered based on the <b>Keywords Filter</b> rules. Verify that your telegram bot service daemon is active.
              </p>
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
