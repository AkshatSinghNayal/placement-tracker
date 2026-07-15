// Company catalog seeder — ported from alembic migration 0002_seed_companies.py.
//
// Idempotent: inserts only when no seeded (is_custom=false) company exists.
// Can be run standalone:  node src/seed/seed.js
// Or imported and called: import { seed } from './seed/seed.js'; await seed()

import { connectDB, closeDB } from '../config/db.js'
import Company from '../models/Company.js'

// ---------------------------------------------------------------------------
// Seed data  (matches original FastAPI migration 0002_seed_companies.py)
// ---------------------------------------------------------------------------

const SEED_COMPANIES = [
  // ── FAANG ────────────────────────────────────────────────────────────────
  {
    name: 'Google',
    cluster: 'FAANG',
    hiring_process:
      'Phone screen → 2–3 technical rounds (DSA + system design) → Hiring Committee review → Offer.',
    oa_pattern: 'LeetCode-style timed OA (90 min, 2 problems). Focus on graphs, DP, strings.',
    frequent_dsa_topics: ['Arrays', 'Graphs', 'Dynamic Programming', 'Strings', 'Trees'],
    core_cs_subjects: ['OS', 'DBMS', 'Computer Networks', 'OOP'],
    resume_requirements:
      'Single-page preferred. Quantify impact. STAR format projects. Include GitHub/portfolio links.',
    interview_experiences: [
      'Had 3 technical rounds: array rotation, LRU cache, word ladder. System design on URL shortener.',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Amazon',
    cluster: 'FAANG',
    hiring_process:
      'Online assessment → Phone screen → Virtual loop (4–5 rounds: 2 coding + 1 system design + 2 bar-raiser behavioral).',
    oa_pattern:
      'Proctored OA (105 min): 2 coding + work simulation. Emphasises LP (Leadership Principles).',
    frequent_dsa_topics: ['Arrays', 'Linked Lists', 'Trees', 'Graphs', 'Dynamic Programming'],
    core_cs_subjects: ['OOP', 'DBMS', 'OS'],
    resume_requirements:
      'Accomplishment-oriented bullets. Use numbers. Each point should reflect a Leadership Principle.',
    interview_experiences: [
      'OA had a tricky DP problem and a work simulation. Loop focused heavily on Leadership Principles (Ownership, Customer Obsession).',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Microsoft',
    cluster: 'FAANG',
    hiring_process:
      'OA or recruiter screen → 4–5 virtual interviews (coding + system design + behavioral) → As-Appropriate round.',
    oa_pattern: 'HackerRank OA: 3 coding problems in 90 min. Medium–Hard LeetCode.',
    frequent_dsa_topics: ['Arrays', 'Trees', 'Dynamic Programming', 'Graphs', 'Recursion'],
    core_cs_subjects: ['OS', 'OOP', 'DBMS', 'Computer Networks'],
    resume_requirements:
      'ATS-friendly. One page for <5 yrs exp. Strong project descriptions with stack and impact.',
    interview_experiences: [
      'Received a hard DP + a medium tree question in OA. Interview loop had system design (design Twitter) and heavy behaviorals.',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Meta',
    cluster: 'FAANG',
    hiring_process:
      'Initial screen → 2 coding phone screens → Onsite (2 coding + 1 system design + 1 behavioral).',
    oa_pattern:
      'Recruiter-given LeetCode-style practice set. Focus on arrays, graphs, recursion.',
    frequent_dsa_topics: ['Arrays', 'Graphs', 'Dynamic Programming', 'Trees', 'Backtracking'],
    core_cs_subjects: ['OS', 'Computer Networks', 'DBMS'],
    resume_requirements: 'Concise. Impact-driven bullets. Projects must have measurable outcomes.',
    interview_experiences: [
      'Phone screen: rotate matrix + merge intervals. Onsite: system design (Instagram feed), graph traversal, behavioral about conflict resolution.',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Apple',
    cluster: 'FAANG',
    hiring_process:
      'Recruiter call → Technical phone screen → Team-specific onsite (4–6 rounds: coding + domain + design).',
    oa_pattern: 'Sometimes HireVue video + coding. Apple-specific: may include practical coding exercise.',
    frequent_dsa_topics: ['Arrays', 'Strings', 'Trees', 'OOP Design', 'Concurrency'],
    core_cs_subjects: ['OS', 'Computer Networks', 'OOP'],
    resume_requirements:
      'Clean format. Emphasise platform-specific experience (iOS, macOS). Quantify contributions.',
    interview_experiences: [
      'Heavy focus on core CS (memory management, threads). Coding round had a binary tree path sum and a string parsing problem.',
    ],
    is_custom: false,
    created_by: null,
  },
  // ── Product-based ────────────────────────────────────────────────────────
  {
    name: 'Flipkart',
    cluster: 'Product-based',
    hiring_process:
      'OA (coding) → Technical interviews (2–3 coding rounds) → Hiring Manager round → HR.',
    oa_pattern:
      'HackerEarth/HackerRank OA: 3 problems, 90 min. Mix of easy/medium/hard DSA.',
    frequent_dsa_topics: ['Arrays', 'Graphs', 'Trees', 'Dynamic Programming', 'Hashing'],
    core_cs_subjects: ['OS', 'DBMS', 'OOP'],
    resume_requirements:
      'Projects should demonstrate product thinking. Include internship and competitive ratings.',
    interview_experiences: [
      'OA had graph + DP. Technical rounds focused on trees and system design (design Amazon cart).',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Adobe',
    cluster: 'Product-based',
    hiring_process: 'Online test → 3 technical rounds (DSA + system design + domain) → HR.',
    oa_pattern: 'Aptitude + coding (2 medium problems, 90 min). Focus on string/array manipulation.',
    frequent_dsa_topics: ['Strings', 'Arrays', 'Graphs', 'Dynamic Programming', 'Math'],
    core_cs_subjects: ['OOP', 'DBMS', 'OS'],
    resume_requirements: 'Clean resume, ATS optimised. Highlight design tools and projects.',
    interview_experiences: [
      'Technical round asked about segment trees. System design on collaborative document editing.',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Salesforce',
    cluster: 'Product-based',
    hiring_process: 'Recruiter screen → Technical assessment → 3 rounds (coding + design + behavioral).',
    oa_pattern: 'Salesforce-specific OA: coding (2 problems) + situational questions.',
    frequent_dsa_topics: ['Arrays', 'Strings', 'OOP Design', 'Databases', 'REST APIs'],
    core_cs_subjects: ['DBMS', 'OOP', 'Computer Networks'],
    resume_requirements: 'Highlight CRM, SaaS, cloud experience. Quantify sales-tech impact.',
    interview_experiences: [
      'Focused on OOP design patterns and REST API design. Behavioral around Salesforce values.',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Swiggy',
    cluster: 'Product-based',
    hiring_process: 'Referral/job portal → OA → 2 coding rounds → System design → Hiring Manager.',
    oa_pattern: 'Codesignal OA: 4 problems, 70 min. Focus on arrays and implementation.',
    frequent_dsa_topics: ['Arrays', 'Graphs', 'Hashing', 'Queues', 'Greedy'],
    core_cs_subjects: ['DBMS', 'OS', 'Computer Networks'],
    resume_requirements: 'Projects with scale. Backend + distributed systems a bonus.',
    interview_experiences: ['Asked for design of order delivery system in 45 min.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Zomato',
    cluster: 'Product-based',
    hiring_process: 'Online test → Coding interviews (2 rounds) → System design → Culture fit.',
    oa_pattern: 'Hackerearth OA: 3 DSA problems in 90 min.',
    frequent_dsa_topics: ['Graphs', 'Dynamic Programming', 'Arrays', 'Hashing', 'Trees'],
    core_cs_subjects: ['DBMS', 'OS', 'OOP'],
    resume_requirements: 'Show real-world project impact. Metrics matter.',
    interview_experiences: ['Dijkstra-based problem in Round 1. System design on restaurant search.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Paytm',
    cluster: 'FinTech',
    hiring_process: 'OA → 2 technical coding rounds → System design → HR.',
    oa_pattern: 'HackerEarth: 3 problems, 60 min. Easy to medium difficulty.',
    frequent_dsa_topics: ['Arrays', 'Strings', 'Linked Lists', 'Trees', 'Hashing'],
    core_cs_subjects: ['DBMS', 'OOP', 'Computer Networks'],
    resume_requirements: 'Highlight payment/fintech stack (Node, Java, Kafka). Scale metrics.',
    interview_experiences: ['Asked to design payment processing system. Round 2 had heavy DBMS.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'PhonePe',
    cluster: 'FinTech',
    hiring_process: 'Referral preferred → OA → 3 technical rounds → Hiring Manager.',
    oa_pattern: 'LeetCode-style OA: 2–3 problems, 90 min. Focus on arrays, graphs.',
    frequent_dsa_topics: ['Arrays', 'Graphs', 'Dynamic Programming', 'Hashing', 'Trees'],
    core_cs_subjects: ['DBMS', 'OS', 'OOP', 'Computer Networks'],
    resume_requirements: 'Mention distributed systems, payments, microservices.',
    interview_experiences: [
      'System design: design UPI transaction routing. Coding: interval merging and trie.',
    ],
    is_custom: false,
    created_by: null,
  },
  // ── Service-based ────────────────────────────────────────────────────────
  {
    name: 'TCS',
    cluster: 'Service-based',
    hiring_process:
      'TCS National Qualifier Test (NQT) → Technical interview → Managerial + HR.',
    oa_pattern:
      'NQT: aptitude + verbal + reasoning + coding (C/C++/Java/Python). 3–4 hours total.',
    frequent_dsa_topics: ['Arrays', 'Strings', 'Basic Data Structures', 'Sorting', 'Recursion'],
    core_cs_subjects: ['OOP', 'DBMS', 'OS', 'Computer Networks'],
    resume_requirements: 'Achievements in academics. Any project/internship welcomed.',
    interview_experiences: [
      'NQT cleared with 70%+ score. HR focused on relocation willingness and TCS values.',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Infosys',
    cluster: 'Service-based',
    hiring_process: 'InfyTQ exam → Power Programmer (optional) → Interview → HR.',
    oa_pattern:
      'InfyTQ: aptitude + pseudo code + data interpretation + coding (2 problems). ~3 hr.',
    frequent_dsa_topics: ['Arrays', 'Strings', 'Sorting', 'Linked Lists', 'Recursion'],
    core_cs_subjects: ['OOP', 'DBMS', 'OS'],
    resume_requirements: 'Academics, any side projects, certifications.',
    interview_experiences: ['Technical round: Java OOP concepts + a simple array question.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Wipro',
    cluster: 'Service-based',
    hiring_process: 'NLTH (National Level Test for Hiring) → Tech interview → HR.',
    oa_pattern:
      'NLTH: aptitude + essay + coding (2 easy problems). Elite NLTH for higher-level hiring.',
    frequent_dsa_topics: ['Arrays', 'Strings', 'Basic Algorithms', 'SQL', 'OOPS'],
    core_cs_subjects: ['DBMS', 'OOP', 'OS', 'Computer Networks'],
    resume_requirements: 'Education, certifications, any internship.',
    interview_experiences: ['Very straightforward. Palindrome check + reverse a linked list.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Accenture',
    cluster: 'Service-based',
    hiring_process:
      'Online assessment → Communication assessment → Logical reasoning test → HR interview.',
    oa_pattern: 'Cognitive assessment (aptitude, logical, verbal) + coding fundamentals.',
    frequent_dsa_topics: ['Arrays', 'Strings', 'Basic Data Structures'],
    core_cs_subjects: ['OOP', 'DBMS'],
    resume_requirements: 'Communication skills, teamwork, certifications.',
    interview_experiences: ['HR focused on career goals and team scenarios.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Cognizant',
    cluster: 'Service-based',
    hiring_process:
      'GenC / GenC Next OA → Technical interview → Communication round → HR.',
    oa_pattern: 'GenC: aptitude + coding (2 easy). GenC Next: harder coding + reasoning.',
    frequent_dsa_topics: ['Arrays', 'Strings', 'Sorting', 'OOP Patterns'],
    core_cs_subjects: ['OOP', 'DBMS', 'Computer Networks'],
    resume_requirements: 'Academic projects, certifications, communication emphasis.',
    interview_experiences: ['Technical round: OOP theory + a sorting problem.'],
    is_custom: false,
    created_by: null,
  },
  // ── FinTech ──────────────────────────────────────────────────────────────
  {
    name: 'Razorpay',
    cluster: 'FinTech',
    hiring_process: 'Referral/portal → OA → 3 technical rounds → System design → Founder round.',
    oa_pattern: 'LeetCode-style, 2 problems, 60 min. Medium–Hard.',
    frequent_dsa_topics: ['Arrays', 'Graphs', 'Dynamic Programming', 'Hashing', 'Queues'],
    core_cs_subjects: ['DBMS', 'OS', 'Computer Networks', 'OOP'],
    resume_requirements: 'Backend heavy, distributed systems, fintech domain knowledge a plus.',
    interview_experiences: [
      'Round 1: LRU cache. Round 2: system design of payment reconciliation. Founder round: product sense.',
    ],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'CRED',
    cluster: 'FinTech',
    hiring_process: 'Referral only or selective → OA → 2–3 coding rounds → Design → Culture fit.',
    oa_pattern: 'Hard LeetCode problems (90 min). Sometimes a take-home assignment.',
    frequent_dsa_topics: ['Graphs', 'Dynamic Programming', 'Concurrency', 'System Design'],
    core_cs_subjects: ['OS', 'DBMS', 'Computer Networks'],
    resume_requirements: 'Strong engineering fundamentals. High-impact projects.',
    interview_experiences: ['Asked to build a in-memory key-value store with TTL. Culture interview was unusual.'],
    is_custom: false,
    created_by: null,
  },
  // ── Startups ─────────────────────────────────────────────────────────────
  {
    name: 'Zepto',
    cluster: 'Startups',
    hiring_process: 'Referral preferred → Take-home or OA → 2 coding rounds → Founder round.',
    oa_pattern: '2 Medium–Hard problems in 60 min. Fast-paced.',
    frequent_dsa_topics: ['Arrays', 'Graphs', 'Greedy', 'Hashing'],
    core_cs_subjects: ['DBMS', 'OS'],
    resume_requirements: 'Startup experience valued. Show you can ship fast.',
    interview_experiences: ['Founder round was a product design discussion on hyperlocal delivery.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Meesho',
    cluster: 'Startups',
    hiring_process: 'OA → 3 technical rounds → Product/culture round.',
    oa_pattern: 'HackerRank: 3 problems (easy to hard), 90 min.',
    frequent_dsa_topics: ['Arrays', 'Trees', 'Dynamic Programming', 'Strings'],
    core_cs_subjects: ['DBMS', 'OOP', 'OS'],
    resume_requirements: 'E-commerce or social commerce projects a plus.',
    interview_experiences: ['Asked about catalog recommendation system in design round.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Groww',
    cluster: 'FinTech',
    hiring_process: 'OA → 2 coding rounds → System design → HR.',
    oa_pattern: 'LeetCode-style: 2–3 problems, 90 min. Medium–Hard.',
    frequent_dsa_topics: ['Arrays', 'Trees', 'Dynamic Programming', 'Hashing', 'Graphs'],
    core_cs_subjects: ['DBMS', 'OS', 'Computer Networks'],
    resume_requirements: 'Finance domain knowledge a bonus. Backend-heavy projects.',
    interview_experiences: ['System design of portfolio tracker. Coding: stock span problem.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Ola',
    cluster: 'Product-based',
    hiring_process: 'OA → Technical rounds (2–3 coding) → System design → Hiring Manager.',
    oa_pattern: 'HackerRank: 3 problems, 90 min.',
    frequent_dsa_topics: ['Graphs', 'Dynamic Programming', 'Arrays', 'Trees'],
    core_cs_subjects: ['DBMS', 'OS', 'Computer Networks'],
    resume_requirements: 'Ride-sharing or maps projects stand out.',
    interview_experiences: ['System design: design Ola ride matching. Coding: Dijkstra variant.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Dream11',
    cluster: 'Product-based',
    hiring_process: 'OA → 2–3 technical rounds → Design → HR.',
    oa_pattern: '3 medium problems, 90 min. Real-time systems focus.',
    frequent_dsa_topics: ['Graphs', 'Dynamic Programming', 'Arrays', 'Hashing', 'Queues'],
    core_cs_subjects: ['DBMS', 'OS', 'Computer Networks'],
    resume_requirements: 'Low-latency, real-time systems experience valued.',
    interview_experiences: ['Design: leaderboard for fantasy cricket with millions of users.'],
    is_custom: false,
    created_by: null,
  },
  {
    name: 'Atlassian',
    cluster: 'Product-based',
    hiring_process: 'Recruiter screen → OA → 4 interviews (coding × 2, system design, values).',
    oa_pattern: 'Codesignal: 4 tasks, 70 min. Medium–Hard.',
    frequent_dsa_topics: ['Arrays', 'Graphs', 'Trees', 'Dynamic Programming', 'OOP Design'],
    core_cs_subjects: ['OS', 'DBMS', 'Computer Networks', 'OOP'],
    resume_requirements: 'DevOps tools, Jira/Confluence familiarity a bonus.',
    interview_experiences: [
      'Values round asked about past team conflicts. Coding had interval scheduling.',
    ],
    is_custom: false,
    created_by: null,
  },
]

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

/**
 * Insert catalog companies once. Idempotent — exits immediately when the
 * seeded companies already exist (no duplicates ever inserted).
 */
export async function seed() {
  const existingCount = await Company.countDocuments({ is_custom: false })

  if (existingCount >= SEED_COMPANIES.length) {
    // eslint-disable-next-line no-console
    console.log(
      `[seeder] ${existingCount} catalog companies already present — skipping.`,
    )
    return
  }

  // Use ordered:false so a partial re-seed on duplicate-name doesn't abort.
  // unique index + is_custom=false acts as the natural guard.
  const toInsert = SEED_COMPANIES.filter(async (c) => {
    const hit = await Company.findOne({ name: c.name, is_custom: false })
    return !hit
  })

  // insertMany is faster than individual saves; collisions are silently ignored.
  await Company.insertMany(SEED_COMPANIES, { ordered: false }).catch((err) => {
    // Bulk-write errors (duplicate key on re-seed) are expected & harmless.
    if (err.code !== 11000 && err.name !== 'MongoBulkWriteError') throw err
  })

  const finalCount = await Company.countDocuments({ is_custom: false })
  // eslint-disable-next-line no-console
  console.log(`[seeder] seeded ${finalCount} catalog companies.`)
}

// ---------------------------------------------------------------------------
// Standalone execution:  node src/seed/seed.js
// ---------------------------------------------------------------------------

const isMain = process.argv[1]?.endsWith('seed.js')
if (isMain) {
  ;(async () => {
    await connectDB()
    await seed()
    await closeDB()
    process.exit(0)
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seeder] fatal:', err)
    process.exit(1)
  })
}
