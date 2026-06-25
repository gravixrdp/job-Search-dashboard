import { useState, useEffect, useCallback } from "react"
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
  uploadResume, getResumeInfo, getSentLog, clearSentLog
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
                { icon: AtSign, label: "Click ✉️ Send Mail on any LinkedIn post or job card with an HR email" },
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
