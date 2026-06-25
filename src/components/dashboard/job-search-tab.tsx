import { useState, useEffect, useMemo } from "react"
import { Plus, Play, RefreshCw, Trash2, ExternalLink, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Field, FieldLabel } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { Job, SearchFilter, JobType, ApplicationStatus, SourcePlatform, ExperienceLevel } from "@/types"
import { getConfig, loadConfigFromServer } from "@/services/config"
import { runLinkedInScraper, runIndeedScraper, runNaukriScraper, runGlassdoorScraper, runInternshalaScraper, runWellfoundScraper, runFounditScraper, runHiristScraper, runShineScraper, transformApifyItemToJob, type ApifyDatasetItem, matchesAllFilters } from "@/services/apify"
import { appendJobs, getAllJobs, updateJobStatus } from "@/services/google-sheets"
import { SendEmailDialog } from "@/components/dashboard/send-email-dialog"

const DEFAULT_KEYWORDS = ["DevOps Engineer", "Cloud Engineer", "SRE", "Platform Engineer", "Infrastructure Engineer"]
const DEFAULT_LOCATIONS = ["Ahmedabad", "Gandhinagar", "Rajkot", "Surat", "Jamnagar", "Vadodara", "Pune", "Bangalore", "Mumbai", "Remote"]

const FILTERS_STORAGE_KEY = "huntsync_filters"

function loadSavedFilters(): SearchFilter[] {
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error("Failed to load filters:", e)
  }
  return []
}

function saveFilters(filters: SearchFilter[]): void {
  localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
}

const statusColors: Record<ApplicationStatus, string> = {
  "To Apply": "bg-secondary text-secondary-foreground",
  "Applied": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Interviewing": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Rejected": "bg-destructive/20 text-destructive",
}

const platformColors: Record<SourcePlatform, string> = {
  "LinkedIn": "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  "Indeed": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Naukri": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Glassdoor": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "Internshala": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "Wellfound": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Foundit": "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  "Hirist": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "Shine": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
}

export function JobSearchTab() {
  const [filters, setFilters] = useState<SearchFilter[]>(loadSavedFilters)
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapingPlatform, setScrapingPlatform] = useState<string | null>(null)
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(["DevOps Engineer"])
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["Remote"])
  const [selectedJobTypes, setSelectedJobTypes] = useState<JobType[]>(["Remote"])
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel>("1-3 years")
  const [customKeyword, setCustomKeyword] = useState("")
  const [customLocation, setCustomLocation] = useState("")

  // Email dialog states
  const [emailRecipient, setEmailRecipient] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [activeJobId, setActiveJobId] = useState("")
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)

  // Client-side filtered jobs based on selected filters
  const currentFilter = useMemo((): SearchFilter => ({
    id: "current",
    name: "Current Filter",
    keywords: selectedKeywords,
    experience: selectedExperience,
    locations: selectedLocations,
    job_types: selectedJobTypes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }), [selectedKeywords, selectedExperience, selectedLocations, selectedJobTypes]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => matchesAllFilters(job, currentFilter))
  }, [jobs, currentFilter])

  useEffect(() => {
    loadConfigFromServer().then(() => loadJobs())
  }, [])

  async function loadJobs() {
    setIsLoading(true)
    try {
      const loadedJobs = await getAllJobs()
      setJobs(loadedJobs)
    } catch (e) {
      console.error("Failed to load jobs:", e)
    } finally {
      setIsLoading(false)
    }
  }

  function addKeyword(keyword: string) {
    if (keyword && !selectedKeywords.includes(keyword)) {
      setSelectedKeywords([...selectedKeywords, keyword])
    }
    setCustomKeyword("")
  }

  function removeKeyword(keyword: string) {
    setSelectedKeywords(selectedKeywords.filter((k) => k !== keyword))
  }

  function addLocation(location: string) {
    if (location && !selectedLocations.includes(location)) {
      setSelectedLocations([...selectedLocations, location])
    }
    setCustomLocation("")
  }

  function removeLocation(location: string) {
    setSelectedLocations(selectedLocations.filter((l) => l !== location))
  }

  function toggleJobType(type: JobType) {
    if (selectedJobTypes.includes(type)) {
      setSelectedJobTypes(selectedJobTypes.filter((t) => t !== type))
    } else {
      setSelectedJobTypes([...selectedJobTypes, type])
    }
  }

  async function saveCurrentFilter() {
    const newFilter: SearchFilter = {
      id: crypto.randomUUID(),
      name: `Filter ${filters.length + 1}`,
      keywords: selectedKeywords,
      experience: selectedExperience,
      locations: selectedLocations,
      job_types: selectedJobTypes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const updatedFilters = [...filters, newFilter]
    setFilters(updatedFilters)
    saveFilters(updatedFilters)
    toast.success("Filter saved successfully")
  }

  async function deleteFilter(filterId: string) {
    const updatedFilters = filters.filter((f) => f.id !== filterId)
    setFilters(updatedFilters)
    saveFilters(updatedFilters)
    toast.success("Filter deleted")
  }

  async function triggerScrapers(platforms: string[]) {
    const config = getConfig()
    if (!config.apify.linkedinActorId) {
      toast.error("Apify actors not configured. Please set them in Configuration tab.")
      return
    }

    const filter: SearchFilter = {
      id: crypto.randomUUID(),
      name: "temp",
      keywords: selectedKeywords,
      experience: selectedExperience,
      locations: selectedLocations,
      job_types: selectedJobTypes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setIsScraping(true)
    let totalAdded = 0

    for (const platform of platforms) {
      setScrapingPlatform(platform)
      try {
        toast.info(`Running ${platform} scraper... This may take a few minutes.`)

        let result
        const scrapers: Record<string, () => Promise<{ items: ApifyDatasetItem[]; platform: string }>> = {
          LinkedIn: () => runLinkedInScraper(config.apify, filter),
          Indeed: () => runIndeedScraper(config.apify, filter),
          Naukri: () => runNaukriScraper(config.apify, filter),
          Glassdoor: () => runGlassdoorScraper(config.apify, filter),
          Internshala: () => runInternshalaScraper(config.apify, filter),
          Wellfound: () => runWellfoundScraper(config.apify, filter),
          Foundit: () => runFounditScraper(config.apify, filter),
          Hirist: () => runHiristScraper(config.apify, filter),
          Shine: () => runShineScraper(config.apify, filter),
        }

        const scraper = scrapers[platform]
        if (!scraper) {
          toast.error(`Unknown platform: ${platform}`)
          continue
        }

        result = await scraper()
        let transformedJobs = result.items.map((item) => transformApifyItemToJob(item, platform))

        // Client-side filter: only keep jobs matching all selected filters
        transformedJobs = transformedJobs.filter(job => matchesAllFilters(job, filter))

        const added = await appendJobs(transformedJobs)
        totalAdded += added
        toast.success(`${platform}: Added ${added} new jobs`)
      } catch (e) {
        const error = e instanceof Error ? e.message : "Unknown error"
        toast.error(`${platform} scraper failed: ${error}`)
      }
    }

    setIsScraping(false)
    setScrapingPlatform(null)
    if (totalAdded > 0) {
      toast.success(`Scraping complete! Added ${totalAdded} total jobs.`)
      await loadJobs()
    }
  }

  async function handleStatusChange(jobId: string, newStatus: ApplicationStatus) {
    try {
      await updateJobStatus(jobId, newStatus)
      setJobs(jobs.map((job) => (job.job_id === jobId ? { ...job, application_status: newStatus } : job)))
      toast.success("Status updated")
    } catch (e) {
      toast.error("Failed to update status")
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Builder Section */}
      <Card>
        <CardHeader>
          <CardTitle>Scraper Filters</CardTitle>
          <CardDescription>
            Configure search parameters for job scraping
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Keywords */}
          <Field>
            <FieldLabel>Keywords</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedKeywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="gap-1">
                  {keyword}
                  <button onClick={() => removeKeyword(keyword)} className="ml-1 hover:text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add keyword..."
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword(customKeyword)}
              />
              <Button variant="outline" size="icon" onClick={() => addKeyword(customKeyword)}>
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {DEFAULT_KEYWORDS.filter((k) => !selectedKeywords.includes(k)).slice(0, 5).map((keyword) => (
                <Badge
                  key={keyword}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => addKeyword(keyword)}
                >
                  + {keyword}
                </Badge>
              ))}
            </div>
          </Field>

          {/* Locations */}
          <Field>
            <FieldLabel>Locations</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedLocations.map((location) => (
                <Badge key={location} variant="secondary" className="gap-1">
                  {location}
                  <button onClick={() => removeLocation(location)} className="ml-1 hover:text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add location..."
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLocation(customLocation)}
              />
              <Button variant="outline" size="icon" onClick={() => addLocation(customLocation)}>
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {DEFAULT_LOCATIONS.filter((l) => !selectedLocations.includes(l)).map((location) => (
                <Badge
                  key={location}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => addLocation(location)}
                >
                  + {location}
                </Badge>
              ))}
            </div>
          </Field>

          {/* Experience */}
          <Field>
            <FieldLabel>Experience Level</FieldLabel>
            <Select value={selectedExperience} onValueChange={(v) => setSelectedExperience(v as ExperienceLevel)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-1 years">0-1 years</SelectItem>
                <SelectItem value="1-3 years">1-3 years</SelectItem>
                <SelectItem value="Internship">Internship</SelectItem>
                <SelectItem value="3-5 years">3-5 years</SelectItem>
                <SelectItem value="5+ years">5+ years</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {/* Job Types */}
          <Field>
            <FieldLabel>Job Types</FieldLabel>
            <div className="flex gap-4">
              {(["Remote", "WFO", "WFH"] as JobType[]).map((type) => (
                <Field key={type} orientation="horizontal">
                  <Checkbox
                    id={`jobtype-${type}`}
                    checked={selectedJobTypes.includes(type)}
                    onCheckedChange={() => toggleJobType(type)}
                  />
                  <FieldLabel htmlFor={`jobtype-${type}`}>{type}</FieldLabel>
                </Field>
              ))}
            </div>
          </Field>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button variant="outline" onClick={saveCurrentFilter}>
              Save Filter
            </Button>
            <Button onClick={() => triggerScrapers(["LinkedIn"])} disabled={isScraping}>
              {isScraping && scrapingPlatform === "LinkedIn" ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Play className="size-4 mr-2" />
              )}
              Scrape LinkedIn
            </Button>
            <Button onClick={() => triggerScrapers(["Indeed"])} disabled={isScraping}>
              {isScraping && scrapingPlatform === "Indeed" ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Play className="size-4 mr-2" />
              )}
              Scrape Indeed
            </Button>
            <Button variant="secondary" onClick={() => triggerScrapers(["LinkedIn", "Indeed"])} disabled={isScraping}>
              {isScraping ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="size-4 mr-2" />
              )}
              Scrape All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Saved Filters */}
      {filters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Badge key={filter.id} variant="outline" className="gap-2 py-2 px-3">
                  <span className="font-medium">{filter.name}</span>
                  <span className="text-muted-foreground">
                    ({filter.keywords.length} keywords, {filter.locations.length} locations)
                  </span>
                  <button
                    onClick={() => deleteFilter(filter.id)}
                    className="hover:text-destructive ml-1"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Job Results</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : selectedLocations.length > 0 || selectedJobTypes.length > 0
                  ? `${filteredJobs.length} of ${jobs.length} jobs shown`
                  : `${jobs.length} jobs found`
                }
              </CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={loadJobs} disabled={isLoading}>
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {isLoading ? "Loading jobs..." : "No jobs match your current filters. Try adjusting location or job type filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow key={job.job_id}>
                      <TableCell>
                        <Badge className={platformColors[job.source_platform]}>
                          {job.source_platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary hover:underline font-medium"
                        >
                          {job.title}
                        </a>
                      </TableCell>
                      <TableCell>{job.company}</TableCell>
                      <TableCell>{job.location}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.job_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={job.application_status}
                          onValueChange={(v) => handleStatusChange(job.job_id, v as ApplicationStatus)}
                        >
                          <SelectTrigger className="w-[120px] h-7 text-xs">
                            <Badge className={statusColors[job.application_status]}>
                              {job.application_status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="To Apply">To Apply</SelectItem>
                            <SelectItem value="Applied">Applied</SelectItem>
                            <SelectItem value="Interviewing">Interviewing</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <a href={job.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Send Application Mail"
                            onClick={() => {
                              const normalizedCompany = job.company.replace(/\s+/g, "").toLowerCase()
                              setEmailRecipient(`hr@${normalizedCompany}.com`)
                              setCompanyName(job.company)
                              setActiveJobId(job.job_id)
                              setIsEmailDialogOpen(true)
                            }}
                          >
                            <Mail className="size-4 text-primary" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      <SendEmailDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
        recipientEmail={emailRecipient}
        companyName={companyName}
        onSuccess={() => {
          if (activeJobId) {
            handleStatusChange(activeJobId, "Applied")
          }
        }}
      />
    </div>
  )
}
