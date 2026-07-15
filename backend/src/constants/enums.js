// Centralised enum string values.
// These MUST match the original FastAPI/Postgres CHECK constraints and the
// React frontend's TypeScript unions byte-for-byte (the UI does literal-string
// comparisons). Keep them here so models + validators share one source of truth.

export const COMPANY_CLUSTERS = [
  'FAANG',
  'Product-based',
  'Service-based',
  'FinTech',
  'Startups',
]

export const APPLICATION_STATUSES = [
  'Not Started',
  'Researching',
  'Applied',
  'OA Received',
  'Interview Scheduled',
  'Offer Received',
  'Rejected',
]

// DSA
export const DSA_PLATFORMS = ['LeetCode', 'GFG', 'Codeforces']
export const DSA_DIFFICULTIES = ['Easy', 'Medium', 'Hard']
export const DSA_STATUSES = [
  'Not Started',
  'In Progress',
  'Solved',
  'Skipped',
  'Marked for Revision',
]
export const DSA_REVISION_STATUSES = ['None', 'Due', 'Done']

// Notes
export const NOTE_TYPES = [
  'Interview Note',
  'Revision Schedule',
  'Concept',
  'HR Answer',
  'Personal',
]

// Resources
export const RESOURCE_CATEGORIES = [
  'Career Portal',
  'Referral',
  'Coding Sheet',
  'Interview Prep',
  'YouTube',
  'Notes',
  'Article',
]

// Convenience Sets for O(1) membership checks in validators.
export const CLUSTER_SET = new Set(COMPANY_CLUSTERS)
export const APP_STATUS_SET = new Set(APPLICATION_STATUSES)
export const DSA_PLATFORM_SET = new Set(DSA_PLATFORMS)
export const DSA_DIFFICULTY_SET = new Set(DSA_DIFFICULTIES)
export const DSA_STATUS_SET = new Set(DSA_STATUSES)
export const DSA_REVISION_SET = new Set(DSA_REVISION_STATUSES)
export const NOTE_TYPE_SET = new Set(NOTE_TYPES)
export const RESOURCE_CATEGORY_SET = new Set(RESOURCE_CATEGORIES)

// Dashboard helpers
export const TERMINAL_APP_STATUSES = new Set(['Offer Received', 'Rejected'])

export const TIMELINE_ACTIONS = new Set([
  'dsa_solved',
  'checklist_item_completed',
  'company_status_changed',
])
