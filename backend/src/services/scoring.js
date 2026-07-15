// Read-time scoring formulas. Ported verbatim from the original FastAPI
// services so dashboard/resume numbers match exactly.
//
//   resume readiness_score = coverage * 0.6 + (active ? 40 : 0)   // 0–100
//   dashboard overall_progress = dsa_pct*0.5 + resume_score*0.3 + checklist_pct*0.2
//   checklist pct            = done / total * 100 (1 decimal; 0 if total 0)

export const READINESS_FORMULA =
  'readiness_score = keyword_coverage_pct * 0.6 + has_active_resume * 0.4'

/** round to 1 decimal place. */
const r1 = (n) => Math.round(n * 10) / 10

/**
 * Resume readiness. Returns { coverage, score, has_active_resume }.
 *
 *  - coverage = present/total*100 (0 if no keywords defined)
 *  - score    = coverage*0.6 + (active ? 40 : 0)   → max = 60 + 40 = 100
 *
 * @param {{keywordTotal: number, keywordPresent: number, hasActiveResume: boolean}} args
 */
export function computeReadiness({ keywordTotal, keywordPresent, hasActiveResume }) {
  const total = keywordTotal || 0
  const present = keywordPresent || 0
  const coverage = total === 0 ? 0.0 : r1((present / total) * 100)
  const score = r1(coverage * 0.6 + (hasActiveResume ? 40.0 : 0.0))
  return { coverage, score, hasActive_resume: Boolean(hasActiveResume) }
}

/**
 * Dashboard overall progress (weighted).
 *   overall = dsa*0.5 + resume*0.3 + checklist*0.2
 */
export function overallProgress(dsaPct, resumeScore, checklistPct) {
  return r1((dsaPct || 0) * 0.5 + (resumeScore || 0) * 0.3 + (checklistPct || 0) * 0.2)
}

/** pct with 1-decimal rounding; 0 when total is 0. */
export function pct(done, total) {
  if (!total) return 0.0
  return r1((done / total) * 100)
}
