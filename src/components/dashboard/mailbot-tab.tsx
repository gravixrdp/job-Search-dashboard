import { useState, useEffect, useCallback, useRef } from "react"
import {
  CheckCircle2, XCircle, Loader2, Eye, EyeOff, Save, Send, Mail,
  ShieldCheck, ShieldAlert, Sparkles, Upload, FileText, Trash2,
  RefreshCw, Clock, Building2, AtSign, MailCheck, AlertTriangle
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

import type { MailbotConfig, SentLogEntry } from "@/types"
import {
  getConfig, loadConfigFromServer, updateMailbotConfig,
  uploadResume, getResumeInfo, getSentLog, clearSentLog,
  deleteFromSentLog, defaultMailbotConfig
} from "@/services/config"

export function MailbotTab() {
  const [config, setConfig] = useState<MailbotConfig>(getConfig().mailbot)
  const [isLoading, setIsLoading] = useState(true)

  // Gmail credentials
  const [gmailUser, setGmailUser] = useState("")
  const [gmailPass, setGmailPass] = useState("")
  const [showPass, setShowPass] = useState(false)

  // Email template
  const [emailSubject, setEmailSubject] = useState("")
  const [emailTemplate, setEmailTemplate] = useState("")

  // Resume
  const [resumeInfo, setResumeInfo] = useState<{ name: string; size: number; hasResume: boolean } | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Sent log
  const [sentLog, setSentLog] = useState<SentLogEntry[]>([])
  const [isLoadingLog, setIsLoadingLog] = useState(false)
  const [isClearingLog, setIsClearingLog] = useState(false)

  // Save state
  const [isSaving, setIsSaving] = useState(false)

  // Direct mailer states
  const [directMailMode, setDirectMailMode] = useState<"single" | "bulk">("single")
  const [singleEmail, setSingleEmail] = useState("")
  const [singleCompany, setSingleCompany] = useState("")
  const [isSingleSending, setIsSingleSending] = useState(false)

  // Bulk sender states
  const [bulkEmailsText, setBulkEmailsText] = useState("")
  const [bulkDelay, setBulkDelay] = useState(10)
  const [isBulkRunning, setIsBulkRunning] = useState(false)
  const [bulkCancel, setBulkCancel] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, sent: 0, skipped: 0, failed: 0 })
  const [bulkLog, setBulkLog] = useState<Array<{ email: string; company: string; status: "pending" | "sending" | "sent" | "skipped" | "failed"; detail: string }>>([])

  const bulkCancelRef = useRef(false)

  const loadSentLog = useCallback(async () => {
    setIsLoadingLog(true)
    try {
      const data = await getSentLog()
      setSentLog(data.entries || [])
    } finally {
      setIsLoadingLog(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadConfigFromServer(), getResumeInfo(), getSentLog()]).then(([loaded, resume, log]) => {
      const mb = loaded.mailbot
      setConfig(mb)
      setGmailUser(mb.gmailUser || "")
      setGmailPass(mb.gmailPass || "")
      setEmailSubject(mb.emailSubject || "")
      setEmailTemplate(mb.emailTemplate || "")
      setResumeInfo(resume)
      setSentLog(log.entries || [])
      setIsLoading(false)
    })
  }, [])

  async function handleSave() {
    setIsSaving(true)
    try {
      const updates: MailbotConfig = { gmailUser, gmailPass, emailSubject, emailTemplate }
      const saved = await updateMailbotConfig(updates)
      setConfig(saved)
      toast.success("Mailbot settings saved!")
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "Unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== "application/pdf") { toast.error("PDF files only!"); return }

    setIsUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64String = (reader.result as string).split(",")[1]
        const res = await uploadResume(file.name, base64String)
        if (res.success) {
          toast.success("Resume PDF uploaded!")
          const info = await getResumeInfo()
          setResumeInfo(info)
        } else {
          toast.error(`Upload failed: ${res.error}`)
        }
        setIsUploading(false)
      }
      reader.onerror = () => { toast.error("Error reading file."); setIsUploading(false) }
      reader.readAsDataURL(file)
    } catch {
      toast.error("Upload error.")
      setIsUploading(false)
    }
  }

  async function handleClearLog() {
    if (!confirm("Clear all sent log entries? This cannot be undone.")) return
    setIsClearingLog(true)
    try {
      const res = await clearSentLog()
      if (res.success) {
        setSentLog([])
        toast.success("Sent log cleared.")
      } else {
        toast.error(`Failed to clear log: ${res.error}`)
      }
    } finally {
      setIsClearingLog(false)
    }
  }

  // Deletes single log item
  const handleDeleteDomainLog = async (domain: string) => {
    if (!confirm(`Delete sent log for ${domain}? This will allow you to send emails to this domain again.`)) return
    try {
      const res = await deleteFromSentLog(domain)
      if (res.success) {
        toast.success(`Deleted ${domain} from Sent Log.`)
        loadSentLog()
      } else {
        toast.error(`Delete failed: ${res.error}`)
      }
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : "Unknown error"}`)
    }
  }

  // Resets template values to codebase defaults
  const handleResetTemplate = () => {
    if (!confirm("Are you sure you want to reset the subject and body to the default DevOps template? Your current edits will be overwritten.")) return
    setEmailSubject(defaultMailbotConfig.emailSubject)
    setEmailTemplate(defaultMailbotConfig.emailTemplate)
    toast.success("Template reset to default values! Click 'Save Settings' to save to server.")
  }

  // Helper: Guess company from email domain
  const guessCompanyFromEmail = (email: string): string => {
    if (!email || !email.includes("@")) return ""
    const domain = email.split("@")[1]?.toLowerCase() || ""
    const parts = domain.split(".")
    const skip = new Set(["mail", "careers", "jobs", "hr", "recruit", "hiring", "apply", "talent", "info", "work", "team"])
    const meaningful = parts.slice(0, -1).filter(p => !skip.has(p))
    const company = meaningful[meaningful.length - 1] || parts[0] || domain
    return company.replace(/^./, c => c.toUpperCase())
  }

  const handleSingleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSingleEmail(val)
    if (val.includes("@")) {
      const guessed = guessCompanyFromEmail(val)
      setSingleCompany(guessed)
    } else {
      setSingleCompany("")
    }
  }

  const handleSendSingle = async (force = false) => {
    if (!singleEmail || !singleCompany) {
      toast.error("Please fill in the email and company name.")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(singleEmail.trim())) {
      toast.error("Please enter a valid email address.")
      return
    }

    setIsSingleSending(true)
    try {
      const subject = emailSubject
      const body = emailTemplate.replace(/{company}/g, singleCompany).replace(/{company_name}/g, singleCompany)

      const res = await sendApplicationEmail(singleEmail.trim(), singleCompany, subject, body, force)
      if (res.success) {
        toast.success(`Email sent to ${singleCompany}!`)
        setSingleEmail("")
        setSingleCompany("")
        loadSentLog()
      } else {
        toast.error(res.error || "Failed to send email.")
      }
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : "Unknown error"}`)
    } finally {
      setIsSingleSending(false)
    }
  }

  const handleCancelBulk = () => {
    bulkCancelRef.current = true
    setBulkCancel(true)
    toast.warning("Cancellation requested. Stopping after current send.")
  }

  const handleStartBulk = async () => {
    const rawEmails = bulkEmailsText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
    const uniqueEmails = Array.from(new Set(rawEmails.map(e => e.toLowerCase().trim())))

    if (uniqueEmails.length === 0) {
      toast.error("No valid email addresses found in text.")
      return
    }

    setIsBulkRunning(true)
    bulkCancelRef.current = false
    setBulkCancel(false)
    
    const total = uniqueEmails.length
    let sent = 0
    let skipped = 0
    let failed = 0

    setBulkProgress({ current: 0, total, sent, skipped, failed })
    setBulkLog([])

    toast.info(`Starting bulk application campaign for ${total} companies...`)

    for (let i = 0; i < total; i++) {
      if (bulkCancelRef.current) {
        setBulkLog(prev => [
          { email: "campaign", company: "Aborted", status: "failed", detail: "Campaign was canceled by the user." },
          ...prev
        ])
        break
      }

      const email = uniqueEmails[i]
      const company = guessCompanyFromEmail(email)
      const domain = email.split("@")[1]?.toLowerCase() || ""

      // Update log to show we are currently sending to this one
      setBulkLog(prev => [
        { email, company, status: "sending", detail: "Checking domain and delivering..." },
        ...prev
      ])

      // Check duplicate
      const isDup = sentLog.some(e => e.domain === domain)
      if (isDup) {
        skipped++
        setBulkProgress(prev => ({ ...prev, current: i + 1, skipped }))
        setBulkLog(prev => {
          const filtered = prev.filter(l => l.email !== email)
          return [
            { email, company, status: "skipped", detail: "Duplicate domain blocked by guard." },
            ...filtered
          ]
        })
        continue
      }

      try {
        const subject = emailSubject
        const body = emailTemplate.replace(/{company}/g, company).replace(/{company_name}/g, company)
        
        const res = await sendApplicationEmail(email, company, subject, body, false)
        if (res.success) {
          sent++
          setBulkProgress(prev => ({ ...prev, current: i + 1, sent }))
          setBulkLog(prev => {
            const filtered = prev.filter(l => l.email !== email)
            return [
              { email, company, status: "sent", detail: "Application email sent successfully!" },
              ...filtered
            ]
          })
          await loadSentLog()
        } else {
          failed++
          setBulkProgress(prev => ({ ...prev, current: i + 1, failed }))
          setBulkLog(prev => {
            const filtered = prev.filter(l => l.email !== email)
            return [
              { email, company, status: "failed", detail: res.error || "SMTP send failed." },
              ...filtered
            ]
          })
        }
      } catch (e) {
        failed++
        setBulkProgress(prev => ({ ...prev, current: i + 1, failed }))
        setBulkLog(prev => {
          const filtered = prev.filter(l => l.email !== email)
          return [
            { email, company, status: "failed", detail: e instanceof Error ? e.message : "SMTP send error." },
            ...filtered
          ]
        })
      }

      // Delay gap if not the last item
      if (i < total - 1 && !bulkCancelRef.current) {
        await new Promise(resolve => setTimeout(resolve, bulkDelay * 1000))
      }
    }

    setIsBulkRunning(false)
    if (bulkCancelRef.current) {
      toast.warning("Bulk application campaign canceled.")
    } else {
      toast.success(`Bulk campaign complete! Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center gap-2">
        <Loader2 className="size-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading mailbot config...</span>
      </div>
    )
  }

  const isConfigured = !!config.gmailUser

  return (
    <div className="grid gap-6 lg:grid-cols-3 max-w-6xl">
      {/* Left — Config Forms */}
      <div className="lg:col-span-2 space-y-6">

        {/* ── Gmail SMTP Credentials ─────────────────────────────────── */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                  <Mail className="size-4.5" />
                </div>
                <div>
                  <CardTitle>Gmail Sender Credentials</CardTitle>
                  <CardDescription>
                    Enter your Gmail address and 16-character App Password to send job application emails.
                  </CardDescription>
                </div>
              </div>
              <div>
                {isConfigured ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 px-2.5 py-0.5">
                    <ShieldCheck className="size-3.5" /> Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5 px-2.5 py-0.5">
                    <ShieldAlert className="size-3.5" /> Not Set
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Gmail Address</FieldLabel>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="vishalgurjar0444@gmail.com"
                    value={gmailUser}
                    onChange={(e) => setGmailUser(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <FieldDescription>The Gmail account emails will be sent from.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>App Password</FieldLabel>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder={config.gmailPass ? "••••••••••••••••" : "16-character App Password"}
                    value={gmailPass}
                    onChange={(e) => setGmailPass(e.target.value)}
                    className="pr-10 font-mono tracking-widest"
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <FieldDescription>
                  Google Account → Security → 2-Step Verification → App Passwords
                </FieldDescription>
              </Field>
            </div>

            {!isConfigured && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>Configure your Gmail credentials to enable sending job application emails directly from the dashboard. Use a Gmail App Password, <strong>not</strong> your real password.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Direct Job Application Mailer ─────────────────────────── */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Send className="size-4.5" />
                </div>
                <div>
                  <CardTitle>Direct Job Application Mailer</CardTitle>
                  <CardDescription>
                    Send application emails directly to specific HR contacts.
                  </CardDescription>
                </div>
              </div>
              <div className="flex p-0.5 bg-muted/60 rounded-lg self-start sm:self-auto border border-border/30">
                <Button
                  variant={directMailMode === "single" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setDirectMailMode("single")}
                  className="px-3 py-1 h-7 text-xs rounded-md"
                >
                  Single Email
                </Button>
                <Button
                  variant={directMailMode === "bulk" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setDirectMailMode("bulk")}
                  className="px-3 py-1 h-7 text-xs rounded-md"
                >
                  Bulk Emails
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {!isConfigured && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>You must configure your Gmail credentials above before sending emails.</span>
              </div>
            )}

            {directMailMode === "single" ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>HR Email Address</FieldLabel>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="hr@company.com"
                        value={singleEmail}
                        onChange={handleSingleEmailChange}
                        disabled={!isConfigured || isSingleSending}
                        className="pl-8"
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel>Company Name</FieldLabel>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Company"
                        value={singleCompany}
                        onChange={(e) => setSingleCompany(e.target.value)}
                        disabled={!isConfigured || isSingleSending}
                        className="pl-8"
                      />
                    </div>
                  </Field>
                </div>

                {/* Duplicate Check Indicator */}
                {singleEmail && (
                  (() => {
                    const domain = singleEmail.split("@")[1]?.toLowerCase() || ""
                    const existing = sentLog.find(e => e.domain === domain)
                    if (existing) {
                      return (
                        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600">
                          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                          <div>
                            <strong>Duplicate Detected!</strong> An email was already sent to <strong>{existing.company}</strong> ({domain}) on <strong>{existing.sent_at}</strong>.
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()
                )}

                {/* Email Preview Details */}
                {singleEmail && (
                  <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/10 text-xs">
                    <div className="bg-muted/30 px-3 py-2 border-b border-border/30 flex items-center justify-between text-muted-foreground font-medium">
                      <span>Email Preview (Auto-generated from template)</span>
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/10">
                        {resumeInfo?.hasResume ? "Resume Attached" : "No Resume Attached"}
                      </Badge>
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <span className="text-muted-foreground font-semibold">Subject: </span>
                        <span className="text-foreground font-medium">{emailSubject}</span>
                      </div>
                      <div className="h-px bg-border/20 my-1" />
                      <div className="text-muted-foreground font-semibold">Body HTML preview:</div>
                      <div
                        className="p-3 bg-background/50 border border-border/20 rounded-lg max-h-40 overflow-y-auto font-mono text-[10px] text-muted-foreground whitespace-pre-wrap"
                      >
                        {emailTemplate.replace(/{company}/g, singleCompany || "[Company Name]").replace(/{company_name}/g, singleCompany || "[Company Name]")}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  {(() => {
                    const domain = singleEmail.split("@")[1]?.toLowerCase() || ""
                    const isDup = !!sentLog.find(e => e.domain === domain)
                    return (
                      <Button
                        onClick={() => handleSendSingle(isDup)}
                        disabled={!isConfigured || !singleEmail || !singleCompany || isSingleSending}
                        className={`w-full sm:w-auto px-6 gap-2 ${isDup ? "bg-amber-600 hover:bg-amber-700 text-white border-none" : ""}`}
                      >
                        {isSingleSending ? (
                          <><Loader2 className="size-4 animate-spin" /> Sending...</>
                        ) : isDup ? (
                          <><AlertTriangle className="size-4" /> Send Anyway (Force)</>
                        ) : (
                          <><Send className="size-4" /> Send Application</>
                        )}
                      </Button>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Field>
                  <FieldLabel>Bulk Emails List</FieldLabel>
                  <Textarea
                    placeholder="Enter email addresses (one per line, space separated, or comma-separated)&#10;e.g.&#10;hr@google.com&#10;recruitment@microsoft.com, jobs@startup.io"
                    value={bulkEmailsText}
                    onChange={(e) => setBulkEmailsText(e.target.value)}
                    disabled={!isConfigured || isBulkRunning}
                    className="min-h-[140px] font-mono text-xs"
                  />
                  <FieldDescription>
                    We'll extract all valid emails, automatically parse company names, skip duplicates, and deliver them in sequence.
                  </FieldDescription>
                </Field>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Delay between sends:</span>
                      <Input
                        type="number"
                        min="1"
                        max="120"
                        value={bulkDelay}
                        onChange={(e) => setBulkDelay(parseInt(e.target.value) || 10)}
                        disabled={!isConfigured || isBulkRunning}
                        className="w-16 h-8 text-center px-1"
                      />
                      <span className="text-xs text-muted-foreground">seconds</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isBulkRunning ? (
                      <Button
                        variant="destructive"
                        onClick={handleCancelBulk}
                        className="gap-2"
                      >
                        <XCircle className="size-4" /> Cancel Campaign
                      </Button>
                    ) : (
                      <Button
                        onClick={handleStartBulk}
                        disabled={!isConfigured || !bulkEmailsText.trim()}
                        className="px-6 gap-2"
                      >
                        <Send className="size-4" /> Start Bulk Send
                      </Button>
                    )}
                  </div>
                </div>

                {/* Bulk Progress Indicator */}
                {isBulkRunning && (
                  <div className="space-y-2 border border-border/40 bg-muted/10 rounded-xl p-3 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Loader2 className="size-3.5 animate-spin" /> Bulk Campaign Processing
                      </span>
                      <span>{bulkProgress.current} / {bulkProgress.total} processed</span>
                    </div>

                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground pt-1">
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-1">
                        <div className="font-bold text-emerald-500">{bulkProgress.sent}</div>
                        <div>Sent</div>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded p-1">
                        <div className="font-bold text-amber-500">{bulkProgress.skipped}</div>
                        <div>Skipped</div>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 rounded p-1">
                        <div className="font-bold text-red-500">{bulkProgress.failed}</div>
                        <div>Failed</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bulk Activity Log */}
                {(bulkLog.length > 0) && (
                  <div className="border border-border/40 rounded-xl overflow-hidden text-xs">
                    <div className="bg-muted/30 px-3 py-2 border-b border-border/30 font-medium text-muted-foreground flex justify-between items-center">
                      <span>Campaign Logs</span>
                      <Button
                        variant="ghost"
                        onClick={() => setBulkLog([])}
                        className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Clear logs
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto p-2 font-mono text-[10px] space-y-1 bg-background/50">
                      {bulkLog.map((log, i) => (
                        <div key={i} className="flex justify-between items-start border-b border-border/10 py-1 last:border-0">
                          <div>
                            <span className="font-semibold text-foreground">{log.company}</span>
                            <span className="text-muted-foreground ml-1">({log.email})</span>
                            <div className="text-[9px] text-muted-foreground">{log.detail}</div>
                          </div>
                          <div>
                            {log.status === "sending" && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] h-4">Sending</Badge>}
                            {log.status === "sent" && <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20 text-[9px] h-4">Sent</Badge>}
                            {log.status === "skipped" && <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 text-[9px] h-4">Skipped</Badge>}
                            {log.status === "failed" && <Badge variant="outline" className="bg-red-500/5 text-red-500 border-red-500/20 text-[9px] h-4">Failed</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── PDF Resume Upload ──────────────────────────────────────── */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                <FileText className="size-4.5" />
              </div>
              <div>
                <CardTitle>Application Resume PDF</CardTitle>
                <CardDescription>
                  This PDF will be auto-attached to every email sent from the dashboard.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-dashed border-border/60 rounded-xl bg-muted/20">
              <div className="flex-1 space-y-1">
                {resumeInfo?.hasResume ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20">Attached</Badge>
                    <span className="font-semibold text-sm max-w-[220px] truncate">{resumeInfo.name}</span>
                    <span className="text-xs text-muted-foreground">({(resumeInfo.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="text-sm text-amber-500 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />No Resume PDF Attached
                  </div>
                )}
                <div className="text-xs text-muted-foreground">PDF format only · max 10 MB</div>
              </div>
              <div className="relative">
                <input
                  type="file" id="resume-file" accept=".pdf"
                  onChange={handleFileChange} className="hidden" disabled={isUploading}
                />
                <Button asChild variant="outline" className="cursor-pointer gap-2" disabled={isUploading}>
                  <label htmlFor="resume-file">
                    {isUploading ? <><Loader2 className="size-4 animate-spin" /> Uploading...</> : <><Upload className="size-4" /> Upload PDF</>}
                  </label>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Email Template ─────────────────────────────────────────── */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                  <Sparkles className="size-4.5" />
                </div>
                <div>
                  <CardTitle>Job Application Template</CardTitle>
                  <CardDescription>
                    Use <code className="text-orange-400 bg-orange-500/10 px-1 rounded text-[11px]">{"{company}"}</code> in the body — it auto-fills with the company name from the email domain.
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetTemplate}
                className="text-xs h-8 gap-1.5 border-dashed"
              >
                <RefreshCw className="size-3" /> Reset default template
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel>Subject Line</FieldLabel>
              <Input
                type="text"
                placeholder="Application for DevOps Role | Your Name | Skills"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>HTML Email Body</FieldLabel>
              <Textarea
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="min-h-[260px] font-mono text-xs leading-relaxed"
                placeholder="<html><body>...</body></html>"
              />
            </Field>
          </CardContent>
        </Card>

        {/* ── Save Button ────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto px-6 gap-2">
            {isSaving ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : <><Save className="size-4" /> Save Settings</>}
          </Button>
        </div>

        {/* ── Sent Log ──────────────────────────────────────────────── */}
        <Card className="border border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                  <MailCheck className="size-4.5" />
                </div>
                <div>
                  <CardTitle>Sent Log · Duplicate Guard</CardTitle>
                  <CardDescription>
                    Every sent email is logged by company domain. Duplicate sends to the same company are automatically blocked.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={loadSentLog} disabled={isLoadingLog} title="Refresh log">
                  <RefreshCw className={`size-4 ${isLoadingLog ? "animate-spin" : ""}`} />
                </Button>
                {sentLog.length > 0 && (
                  <Button variant="ghost" size="icon" onClick={handleClearLog} disabled={isClearingLog} className="text-destructive hover:text-destructive" title="Clear all">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingLog ? (
              <div className="flex h-24 items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" /> Loading log...
              </div>
            ) : sentLog.length === 0 ? (
              <div className="flex flex-col h-24 items-center justify-center gap-2 text-muted-foreground text-sm">
                <Send className="size-8 opacity-20" />
                <span>No emails sent yet — send your first application!</span>
              </div>
            ) : (
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/30">
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground"><div className="flex items-center gap-1.5"><Building2 className="size-3" />Company</div></th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground"><div className="flex items-center gap-1.5"><AtSign className="size-3" />Email</div></th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground"><div className="flex items-center gap-1.5"><Clock className="size-3" />Sent At</div></th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentLog.map((entry, i) => (
                      <tr key={entry.domain} className={`border-b border-border/20 last:border-0 ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"} hover:bg-primary/5 transition-colors`}>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-foreground">{entry.company}</div>
                          <div className="text-muted-foreground text-[10px]">{entry.domain}</div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground font-mono">{entry.email}</td>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{entry.sent_at}</td>
                        <td className="px-3 py-2.5">
                          {entry.status === "bounced" ? (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 gap-1 text-[10px]">
                              <XCircle className="size-3" /> Bounced
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 text-[10px]">
                              <CheckCircle2 className="size-3" /> Sent
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteDomainLog(entry.domain)}
                            title="Delete entry (resets duplicate guard)"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-muted/20 border-t border-border/30 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{sentLog.length} companies contacted · duplicate sends blocked</span>
                  <Badge variant="outline" className="gap-1 text-[10px] bg-cyan-500/10 text-cyan-500 border-cyan-500/20">
                    <ShieldCheck className="size-3" /> Duplicate Guard Active
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right — Status Sidebar */}
      <div className="space-y-5">

        {/* Quick Stats */}
        <Card className="border border-border/40 bg-gradient-to-br from-cyan-500/5 to-indigo-500/5 backdrop-blur-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-cyan-500">
              <Sparkles className="size-4" />
              <CardTitle className="text-sm font-semibold">Campaign Stats</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total Sent</span>
              <span className="font-bold text-lg tabular-nums">{sentLog.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Bounced</span>
              <span className="font-bold text-lg tabular-nums text-red-500">{sentLog.filter(e => e.status === "bounced").length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Delivered</span>
              <span className="font-bold text-lg tabular-nums text-emerald-500">{sentLog.filter(e => e.status === "sent").length}</span>
            </div>
            <div className="h-px bg-border/30 my-1" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Resume Attached</span>
              {resumeInfo?.hasResume ? (
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 text-[10px]">Yes</Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">No</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Gmail Configured</span>
              {isConfigured ? (
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 text-[10px]">Yes</Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">No</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="border border-border/40 bg-card/50 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-xs text-muted-foreground">
              {[
                { icon: Mail, label: "Configure Gmail credentials above" },
                { icon: FileText, label: "Upload your resume PDF once" },
                { icon: Sparkles, label: "Edit your HTML email template" },
                { icon: Send, label: "Enter HR emails in the Direct Mailer to apply directly" },
                { icon: ShieldCheck, label: "Duplicate Guard blocks re-sending to the same company domain" },
                { icon: MailCheck, label: "Every send is logged here with timestamp" },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] mt-0.5">
                    {i + 1}
                  </div>
                  <span className="leading-relaxed">{step.label}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Gmail App Password help */}
        <Card className="border border-border/40 bg-card/50 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" />App Password Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p>Your real Gmail password will NOT work. You need a 16-character App Password:</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Go to <strong>myaccount.google.com</strong></li>
              <li>Security → 2-Step Verification</li>
              <li>Scroll down → App Passwords</li>
              <li>Select Mail → Generate</li>
              <li>Copy the 16-char code here</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
