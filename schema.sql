-- HuntSync AI - Cloudflare D1 Schema
-- Primary database for jobs, posts, config, and filters

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  source_platform TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT DEFAULT '',
  job_type TEXT DEFAULT 'Remote',
  experience_req TEXT DEFAULT '',
  url TEXT DEFAULT '',
  date_posted TEXT DEFAULT '',
  scraped_at TEXT DEFAULT '',
  application_status TEXT DEFAULT 'To Apply'
);

CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(source_platform);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(application_status);

CREATE TABLE IF NOT EXISTS linkedin_posts (
  post_id TEXT PRIMARY KEY,
  author_name TEXT DEFAULT '',
  author_title TEXT DEFAULT '',
  post_text TEXT DEFAULT '',
  post_url TEXT DEFAULT '',
  email TEXT DEFAULT '',
  experience_req TEXT DEFAULT '',
  detected_keywords TEXT DEFAULT '',
  scraped_at TEXT DEFAULT '',
  status TEXT DEFAULT 'Unread'
);

CREATE INDEX IF NOT EXISTS idx_posts_status ON linkedin_posts(status);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS filters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);
