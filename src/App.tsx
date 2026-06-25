import { useState } from "react"
import { Search, UserRoundSearch, Settings, Briefcase, Bot } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ModeToggle } from "@/components/mode-toggle"
import { Toaster } from "@/components/ui/sonner"

import { JobSearchTab } from "@/components/dashboard/job-search-tab"
import { SocialListeningTab } from "@/components/dashboard/social-listening-tab"
import { ConfigTab } from "@/components/dashboard/config-tab"
import { MailbotTab } from "@/components/dashboard/mailbot-tab"

export function App() {
  const [activeTab, setActiveTab] = useState("jobs")

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Briefcase className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">gravix-job</h1>
              <p className="text-xs text-muted-foreground">Job Search Command Center</p>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <main className="container px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="jobs" className="gap-2">
              <Search className="size-4" />
              Job Search
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-2">
              <UserRoundSearch className="size-4" />
              Social Listening
            </TabsTrigger>
            <TabsTrigger value="mailbot" className="gap-2">
              <Bot className="size-4" />
              Mailbot
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="size-4" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <JobSearchTab />
          </TabsContent>
          <TabsContent value="social">
            <SocialListeningTab />
          </TabsContent>
          <TabsContent value="mailbot">
            <MailbotTab />
          </TabsContent>
          <TabsContent value="config">
            <ConfigTab />
          </TabsContent>
        </Tabs>
      </main>

      <Toaster />
    </div>
  )
}

export default App
