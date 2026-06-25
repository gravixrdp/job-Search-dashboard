import { useState, useEffect } from "react"
import { Mail, Loader2, AlertCircle, FileText, Send } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getConfig, sendApplicationEmail, getResumeInfo } from "@/services/config"

interface SendEmailDialogProps {
  isOpen: boolean
  onClose: () => void
  recipientEmail: string
  companyName: string
  onSuccess?: () => void
}

export function SendEmailDialog({
  isOpen,
  onClose,
  recipientEmail,
  companyName,
  onSuccess,
}: SendEmailDialogProps) {
  const [to, setTo] = useState(recipientEmail)
  const [company, setCompany] = useState(companyName)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [resumeInfo, setResumeInfo] = useState<{ name: string; size: number; hasResume: boolean } | null>(null)

  // Load defaults from config
  useEffect(() => {
    if (isOpen) {
      setTo(recipientEmail)
      setCompany(companyName)
      
      const config = getConfig().mailbot
      setSubject(config.emailSubject || "Application for DevOps Engineer Role")
      
      // Inject company name into the template if {company} is present
      const rawTemplate = config.emailTemplate || ""
      const parsedBody = rawTemplate.replace(/{company}/g, companyName)
      setBody(parsedBody)

      // Get resume info
      getResumeInfo().then(info => setResumeInfo(info))
    }
  }, [isOpen, recipientEmail, companyName])

  // Update body when company input changes manually
  const handleCompanyChange = (val: string) => {
    setCompany(val)
    const config = getConfig().mailbot
    const rawTemplate = config.emailTemplate || ""
    const parsedBody = rawTemplate.replace(/{company}/g, val)
    setBody(parsedBody)
  }

  const handleSend = async () => {
    if (!to || !company || !subject || !body) {
      toast.error("Please fill in all fields before sending.")
      return
    }
    setIsSending(true)
    try {
      const res = await sendApplicationEmail(to, company, subject, body) as { success: boolean; duplicate?: boolean; error?: string }
      if (res.success) {
        toast.success("Application email sent successfully!")
        if (onSuccess) onSuccess()
        onClose()
      } else if (res.duplicate) {
        toast.warning(`Duplicate blocked: ${res.error}`, { duration: 6000 })
        onClose()
      } else {
        toast.error(`Email delivery failed: ${res.error}`)
      }
    } catch (e) {
      toast.error(`Failed to send email: ${e instanceof Error ? e.message : "Unknown error"}`)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl border border-border/50 bg-card/90 backdrop-blur-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Send Job Application Email
          </DialogTitle>
          <DialogDescription>
          Verify and customize the application details before sending. Emails are sent via your Gmail account. Duplicate sends to the same company domain are automatically blocked.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Email</Label>
              <Input
                id="recipient"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="hr@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => handleCompanyChange(e.target.value)}
                placeholder="Google"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Application Subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Template Preview (HTML supported)</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[220px] font-mono text-xs leading-relaxed"
              placeholder="Email HTML content"
            />
          </div>

          {/* Resume Indicator */}
          <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/30 p-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="size-4 text-primary" />
              {resumeInfo?.hasResume ? (
                <div>
                  <span className="font-semibold text-foreground">{resumeInfo.name}</span>
                  <span className="ml-1 text-[10px]">({(resumeInfo.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <span className="text-amber-500 flex items-center gap-1 font-medium">
                  <AlertCircle className="size-3.5" /> No resume PDF attached. Set it in Mailbot settings.
                </span>
              )}
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              PDF Attachment
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending} className="gap-1.5">
            {isSending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="size-3.5" /> Send Application
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
