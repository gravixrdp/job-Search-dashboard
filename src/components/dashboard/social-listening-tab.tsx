import { useState, useEffect, useMemo } from "react"
import { Play, RefreshCw, ExternalLink, Loader2, User, AtSign, Mail, Briefcase } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { LinkedInHiringPost, PostStatus } from "@/types"
import { getConfig, loadConfigFromServer } from "@/services/config"
import { runLinkedInPostScraper, transformApifyItemToLinkedInPost, buildBooleanSearchQuery } from "@/services/apify"
import { appendLinkedInPosts, getAllLinkedInPosts, updatePostStatus } from "@/services/google-sheets"
import { SendEmailDialog } from "@/components/dashboard/send-email-dialog"

const LOCATION_OPTIONS = [
  "Remote", "Ahmedabad", "Gandhinagar", "Rajkot", "Surat", "Jamnagar", "Vadodara",
] as const

const DEFAULT_QUERIES = [
  { label: "DevOps Hiring", query: '("hiring" OR "looking for") AND ("DevOps" OR "Cloud Engineer" OR "SRE")' },
  { label: "Tech Remote", query: '("hiring" OR "looking for") AND ("Tech" OR "Software") AND "Remote"' },
  { label: "Platform Engineer", query: '("hiring" OR "looking for") AND ("Platform Engineer" OR "Infrastructure")' },
]

const postStatusColors: Record<PostStatus, string> = {
  "Unread": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Contacted": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Ignored": "bg-muted text-muted-foreground",
}

export function SocialListeningTab() {
  const [searchQuery, setSearchQuery] = useState('(hiring OR "looking for") AND (DevOps OR Cloud)')
  const [posts, setPosts] = useState<LinkedInHiringPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<string>("all")

  // Email dialog states
  const [emailRecipient, setEmailRecipient] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [activePostId, setActivePostId] = useState("")
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)

  const filteredPosts = useMemo(() => {
    let result = posts

    // Location filter (client-side substring match on post_text)
    if (selectedLocations.length > 0) {
      result = result.filter((post) => {
        const text = post.post_text.toLowerCase()
        return selectedLocations.some((loc) => {
          if (loc === "Remote") {
            return text.includes("remote") || text.includes("work from anywhere") || text.includes("wfh")
          }
          return text.includes(loc.toLowerCase())
        })
      })
    }

    // Date filter (client-side based on scraped_at)
    if (dateFilter !== "all") {
      const now = Date.now()
      const cutoffMap: Record<string, number> = {
        "24h": now - 24 * 60 * 60 * 1000,
        "7d": now - 7 * 24 * 60 * 60 * 1000,
        "14d": now - 14 * 24 * 60 * 60 * 1000,
      }
      const cutoff = cutoffMap[dateFilter]
      if (cutoff) {
        result = result.filter((post) => {
          if (!post.scraped_at) return true
          return new Date(post.scraped_at).getTime() >= cutoff
        })
      }
    }

    return result
  }, [posts, selectedLocations, dateFilter])

  useEffect(() => {
    loadConfigFromServer().then(() => loadPosts())
  }, [])

  async function loadPosts() {
    setIsLoading(true)
    try {
      const loadedPosts = await getAllLinkedInPosts()
      setPosts(loadedPosts)
    } catch (e) {
      console.error("Failed to load posts:", e)
    } finally {
      setIsLoading(false)
    }
  }

  async function triggerSocialScraper() {
    const config = getConfig()
    if (!config.apify.linkedinPostActorId) {
      toast.error("Apify actors not configured. Please set them in Configuration tab.")
      return
    }

    setIsScraping(true)
    try {
      const booleanQuery = buildBooleanSearchQuery(searchQuery)
      toast.info("Running LinkedIn Post scraper. This may take a few minutes...")

      const datasetItems = await runLinkedInPostScraper(config.apify, booleanQuery)
      const transformedPosts = datasetItems.map((item) => transformApifyItemToLinkedInPost(item))

      // Filter to posts from last 7 days
      const recentPosts = transformedPosts // In real impl, filter by date

      const added = await appendLinkedInPosts(recentPosts)
      toast.success(`Added ${added} new hiring posts`)

      await loadPosts()
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error"
      toast.error(`Failed to scrape posts: ${error}`)
    } finally {
      setIsScraping(false)
    }
  }

  async function handleStatusChange(postId: string, newStatus: PostStatus) {
    try {
      await updatePostStatus(postId, newStatus)
      setPosts(posts.map((post) => (post.post_id === postId ? { ...post, status: newStatus } : post)))
      toast.success("Status updated")
    } catch (e) {
      toast.error("Failed to update status")
    }
  }

  function usePresetQuery(query: string) {
    setSearchQuery(query)
  }

  function highlightKeywords(text: string, keywords: string): string {
    if (!keywords) return text
    const keywordList = keywords.split(", ").filter(Boolean)
    let highlighted = text
    keywordList.forEach((kw) => {
      const regex = new RegExp(`(${kw})`, "gi")
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>')
    })
    return highlighted
  }

  return (
    <div className="space-y-6">
      {/* Query Builder */}
      <Card>
        <CardHeader>
          <CardTitle>Target Query Builder</CardTitle>
          <CardDescription>
            Build boolean search queries to find hiring posts from recruiters and founders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field>
            <FieldLabel>Boolean Search Query</FieldLabel>
            <Textarea
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='("hiring" OR "looking for") AND ("DevOps" OR "Cloud") AND ("Ahmedabad" OR "Remote")'
              className="font-mono text-sm min-h-[100px]"
            />
            <FieldDescription>
              Use boolean operators: AND, OR, NOT. Combine keywords and locations.
            </FieldDescription>
          </Field>

          {/* Location Filter */}
          <Field>
            <FieldLabel>Filter by Location</FieldLabel>
            <div className="flex flex-wrap gap-3">
              {LOCATION_OPTIONS.map((loc) => (
                <label key={loc} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedLocations.includes(loc)}
                    onCheckedChange={(checked) => {
                      setSelectedLocations((prev) =>
                        checked ? [...prev, loc] : prev.filter((l) => l !== loc)
                      )
                    }}
                  />
                  {loc}
                </label>
              ))}
            </div>
          </Field>

          {/* Date Filter */}
          <Field>
            <FieldLabel>Filter by Date</FieldLabel>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="14d">Last 14 Days</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              Filters posts based on when they were scraped.
            </FieldDescription>
          </Field>

          {/* Quick Presets */}
          <div>
            <FieldLabel className="text-sm mb-2">Quick Presets</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_QUERIES.map((preset) => (
                <Badge
                  key={preset.label}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => usePresetQuery(preset.query)}
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={triggerSocialScraper} disabled={isScraping}>
              {isScraping ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Play className="size-4 mr-2" />
              )}
              Start Social Scraper
            </Button>
            <Button variant="outline" onClick={loadPosts} disabled={isLoading}>
              <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Posts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recruiter Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Hiring Post Feed</CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : selectedLocations.length > 0 || dateFilter !== "all"
              ? `${filteredPosts.length} of ${posts.length} hiring posts shown`
              : `${posts.length} hiring posts found`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {filteredPosts.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                {isLoading ? "Loading posts..." : "No hiring posts found. Configure your search query and click 'Start Social Scraper'."}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <Card key={post.post_id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted shrink-0">
                            <User className="size-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{post.author_name}</span>
                              <Badge
                                className={postStatusColors[post.status]}
                                variant="outline"
                              >
                                {post.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                              <AtSign className="size-3" />
                              {post.author_title}
                            </div>
                            {(post.email || post.experience_req) && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {post.email && (
                                  <Badge variant="outline" className="text-xs">
                                    <Mail className="size-3 mr-1" />
                                    <span className="cursor-pointer hover:underline" onClick={() => {
                                      setEmailRecipient(post.email)
                                      // Extract company name from email domain
                                      const emailDomain = post.email.split("@")[1]?.split(".")[0] || ""
                                      setCompanyName(emailDomain.charAt(0).toUpperCase() + emailDomain.slice(1))
                                      setActivePostId(post.post_id)
                                      setIsEmailDialogOpen(true)
                                    }}>{post.email}</span>
                                  </Badge>
                                )}
                                {post.experience_req && (
                                  <Badge variant="outline" className="text-xs">
                                    <Briefcase className="size-3 mr-1" />
                                    {post.experience_req}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <p
                              className="text-sm leading-relaxed line-clamp-4"
                              dangerouslySetInnerHTML={{
                                __html: highlightKeywords(post.post_text, post.detected_keywords),
                              }}
                            />
                            {post.detected_keywords && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {post.detected_keywords.split(", ").map((kw) => (
                                  <Badge key={kw} variant="secondary" className="text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end shrink-0">
                          <div className="flex gap-1">
                            <Select
                              value={post.status}
                              onValueChange={(v) => handleStatusChange(post.post_id, v as PostStatus)}
                            >
                              <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Unread">Unread</SelectItem>
                                <SelectItem value="Contacted">Contacted</SelectItem>
                                <SelectItem value="Ignored">Ignored</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={post.post_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-3 mr-1" />
                              Open Post
                            </a>
                          </Button>
                          {post.email && (
                            <Button 
                              size="sm" 
                              className="w-full gap-1 h-8 text-xs bg-primary hover:bg-primary/90"
                              onClick={() => {
                                setEmailRecipient(post.email)
                                const emailDomain = post.email.split("@")[1]?.split(".")[0] || ""
                                setCompanyName(emailDomain.charAt(0).toUpperCase() + emailDomain.slice(1))
                                setActivePostId(post.post_id)
                                setIsEmailDialogOpen(true)
                              }}
                            >
                              <Mail className="size-3" />
                              Send Mail
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      <SendEmailDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
        recipientEmail={emailRecipient}
        companyName={companyName}
        onSuccess={() => {
          if (activePostId) {
            handleStatusChange(activePostId, "Contacted")
          }
        }}
      />
    </div>
  )
}
