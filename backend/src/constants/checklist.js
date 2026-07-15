// The 15 fixed checklist items, seeded into a UserCompany when the user
// starts tracking a company (POST /companies/{id}/track). Ported verbatim
// from app/models/company.py CHECKLIST_ITEMS so the seeded labels match.

export const CHECKLIST_ITEMS = [
  ['resume_tailored', 'Resume tailored for this company'],
  ['resume_ats_checked', 'Resume checked with ATS scanner'],
  ['dsa_sheet_completed', 'Company-specific DSA sheet completed'],
  ['oa_practice_completed', 'OA practice (past papers + timed)'],
  ['aptitude_prepared', 'Aptitude / reasoning prepared'],
  ['dbms_revised', 'DBMS revised'],
  ['os_revised', 'OS revised'],
  ['cn_revised', 'Computer Networks revised'],
  ['oop_revised', 'OOP revised'],
  ['hr_questions_prepared', 'HR + behavioural questions prepared'],
  ['projects_revised', 'Projects revised (can explain end-to-end)'],
  ['applied', 'Application submitted'],
  ['oa_received', 'OA received'],
  ['interview_scheduled', 'Interview scheduled'],
  ['offer_received', 'Offer received'],
]
