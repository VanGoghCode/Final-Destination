// ========================================
// USER PROMPTS — data templates
// Injected with actual values before sending.
//
// DISCLAIMER: These templates carry the user's real
// personal data (resume, job descriptions, etc.).
// Never commit actual user data to version control.
// ========================================

// --------------------------------------------------
// Resume Tailoring
// --------------------------------------------------

export interface ResumeTailoringData {
  masterContext: string;
  resumeLatex: string;
  jobDescription: string;
  personalDetails: string;
  manualResearch?: string;
  /** Character budget for visible text content (excl. LaTeX markup). */
  contentCharBudget?: { floor: number; target: number; limit: number };
}

export function buildResumeUserPrompt(data: ResumeTailoringData): string {
  const researchBlock = data.manualResearch
    ? `\n## MANUAL RESEARCH NOTES:\n${data.manualResearch}\n`
    : "";

  const budgetBlock = data.contentCharBudget
    ? `## CHARACTER BUDGET (visible text only — excludes LaTeX commands/markup):
Floor: ${data.contentCharBudget.floor.toLocaleString()} characters
Target: ${data.contentCharBudget.target.toLocaleString()} characters (original resume length)
Hard cap: ${data.contentCharBudget.limit.toLocaleString()} characters

`
    : "";

  return `## CANDIDATE MASTER CONTEXT (authoritative source):
${data.masterContext}

## ORIGINAL RESUME (LaTeX):
${data.resumeLatex}

## JOB DESCRIPTION:
${data.jobDescription}

## PERSONAL DETAILS:
${data.personalDetails}
${researchBlock}${budgetBlock}## INSTRUCTIONS:
Use the Master Context as the AUTHORITATIVE source for the candidate's real skills, experiences, and achievements. The Original Resume provides the LaTeX formatting and structure to preserve. Tailor the content in the LaTeX template using information from the Master Context to best match the Job Description.

CRITICAL: Do NOT invent skills, experiences, metrics, or achievements not present in the Master Context. If the JD asks for something the candidate doesn't have, do NOT add it. The candidate will address gaps themselves.

The Master Context contains everything the candidate can legitimately claim. Use it wisely to demonstrate domain fit with the company's work.`;
}

// --------------------------------------------------
// Cover Letter Tailoring
// --------------------------------------------------

export interface CoverLetterData {
  masterContext: string;
  coverLetterLatex: string;
  jobDescription: string;
  personalDetails: string;
  manualResearch?: string;
  tailoredResume?: string;
}

export function buildCoverLetterUserPrompt(data: CoverLetterData): string {
  const researchBlock = data.manualResearch
    ? `\n## MANUAL RESEARCH NOTES:\n${data.manualResearch}\n`
    : "";

  const resumeBlock = data.tailoredResume
    ? `\n## TAILORED RESUME (for reference):\n${data.tailoredResume}\n`
    : "";

  return `## CANDIDATE MASTER CONTEXT (authoritative source):
${data.masterContext}

## ORIGINAL COVER LETTER (LaTeX — formatting shell, preserve structure):
${data.coverLetterLatex}

## JOB DESCRIPTION:
${data.jobDescription}

## PERSONAL DETAILS:
${data.personalDetails}
${researchBlock}${resumeBlock}
## INSTRUCTIONS:
Use the Master Context as the AUTHORITATIVE source for the candidate's real background, voice, and achievements. The Original Cover Letter provides the LaTeX formatting. Tailor the content using information from the Master Context to show domain fit.

Craft a cover letter that sounds like a real person wrote it — direct, specific, and genuine. Show you understand what the company actually does. Explain how the candidate's experience makes them relevant for THIS specific role.

CRITICAL: Only reference skills and experience from the Master Context. Do not fabricate achievements.

Follow the tone rules in your system instructions exactly.`;
}

// --------------------------------------------------
// Answers Generation
// --------------------------------------------------

export interface AnswersData {
  masterContext: string;
  questions: string;
  tailoredResume: string;
  tailoredCoverLetter?: string;
  jobDescription: string;
}

export function buildAnswersUserPrompt(data: AnswersData): string {
  const coverLetterBlock = data.tailoredCoverLetter
    ? `\n### Tailored Cover Letter:\n${data.tailoredCoverLetter}\n`
    : "\n### Tailored Cover Letter: Not provided\n";

  return `## CANDIDATE MASTER CONTEXT:
${data.masterContext}

## APPLICATION CONTEXT:
### Job Description:
${data.jobDescription}

### Tailored Resume:
${data.tailoredResume}
${coverLetterBlock}
## QUESTIONS TO ANSWER:
${data.questions}

## INSTRUCTIONS:
Answer each question in FIRST PERSON ("I", "my", "me"). Use the Master Context for accurate details about the candidate. Follow the tone rules in your system instructions exactly. If a question has a [LIMIT: X words/characters] tag, strictly adhere to the limit.

CRITICAL: Only reference real experience from the Master Context. Do not fabricate answers. If you don't have enough context to answer honestly, acknowledge that rather than inventing.`;
}

// --------------------------------------------------
// Cold Email
// --------------------------------------------------

export interface EmailData {
  masterContext: string;
  positionTitle: string;
  companyName: string;
  jobDescription: string;
  tailoredResume: string;
  tailoredCoverLetter: string;
}

export function buildColdEmailUserPrompt(data: EmailData): string {
  return `## CANDIDATE MASTER CONTEXT:
${data.masterContext}

## CONTEXT:
- Position: ${data.positionTitle}
- Company: ${data.companyName}
- Job Description: ${data.jobDescription}
- Resume highlights: ${data.tailoredResume.slice(0, 2000)}
- Cover Letter insights: ${data.tailoredCoverLetter.slice(0, 1500)}

## INSTRUCTIONS:
Write a compelling cold outreach email to a hiring authority (Director, VP, Hiring Manager). Follow the tone rules in system instructions exactly. 100-200 words. Start with a hook about the company. Focus on value you bring to them. End with a clear CTA ("Would love 15 minutes to discuss how I could help with X"). Do NOT mention attachments.

CRITICAL: Only reference real experience. Do not fabricate credentials or claims.`;
}

// --------------------------------------------------
// Reference Request Email
// --------------------------------------------------

export function buildReferenceEmailUserPrompt(data: EmailData): string {
  return `## CANDIDATE MASTER CONTEXT:
${data.masterContext}

## CONTEXT:
- Position: ${data.positionTitle}
- Company: ${data.companyName}
- Job Description: ${data.jobDescription}
- Resume highlights: ${data.tailoredResume.slice(0, 2000)}

## INSTRUCTIONS:
Write a warm, genuine email to an employee asking for a referral for the ${data.positionTitle} role. Follow tone rules in system instructions. 100-200 words. Brief warm greeting. Mention how you found them. Clear ask — be humble and appreciative. Brief (1-2 sentences) on why you'd fit. Express gratitude regardless of outcome. No pressure — make it clear it's okay to say no.`;
}

// --------------------------------------------------
// Location Extraction
// --------------------------------------------------

export interface LocationExtractionData {
  jobDescription: string;
  companyName: string;
}

export function buildLocationExtractionUserPrompt(data: LocationExtractionData): string {
  return `## JOB DESCRIPTION:
${data.jobDescription}

## COMPANY: ${data.companyName || "Not specified"}

## TASK:
Extract country and work mode. Country: infer from city names, currency, or company HQ. Work mode: "Remote", "Hybrid", or "On-site". Default to "On-site" if unspecified. "Remote-first" = Remote. "Flexible" = Hybrid.

## OUTPUT (JSON only, no markdown):
{"country": "COUNTRY_NAME", "workMode": "Remote|Hybrid|On-site"}`;
}

// --------------------------------------------------
// Regeneration Prompts
// --------------------------------------------------

export interface RegenerationData {
  userComment: string;
  currentContent: string;
  originalLatex: string;
  jobDescription: string;
  personalDetails: string;
  masterContext: string;
}

export function buildResumeRegenerationUserPrompt(data: RegenerationData): string {
  return `## CANDIDATE MASTER CONTEXT:
${data.masterContext}

## USER'S FEEDBACK:
${data.userComment}

## CURRENT TAILORED RESUME (to modify):
${data.currentContent}

## ORIGINAL RESUME TEMPLATE (for reference):
${data.originalLatex}

## JOB DESCRIPTION:
${data.jobDescription}

## PERSONAL DETAILS:
${data.personalDetails}

## INSTRUCTIONS:
Apply the user's specific feedback to the Current Tailored Resume. Use Master Context as authoritative source. Preserve LaTeX structure. Return ONLY the complete LaTeX code, no markdown wrapping. Do NOT use ** or em dashes. Do not fabricate content.`;
}

export function buildCoverLetterRegenerationUserPrompt(data: RegenerationData): string {
  return `## CANDIDATE MASTER CONTEXT:
${data.masterContext}

## USER'S FEEDBACK:
${data.userComment}

## CURRENT TAILORED COVER LETTER (to modify):
${data.currentContent}

## ORIGINAL COVER LETTER TEMPLATE (for reference):
${data.originalLatex}

## JOB DESCRIPTION:
${data.jobDescription}

## PERSONAL DETAILS:
${data.personalDetails}

## INSTRUCTIONS:
Apply the user's feedback to the Current Cover Letter. Use Master Context for accurate details. Preserve LaTeX structure. Return ONLY complete LaTeX code, no markdown wrapping. Do NOT use ** or em dashes. Do not fabricate content.`;
}

// --------------------------------------------------
// General Question
// --------------------------------------------------

export interface QuestionData {
  masterContext: string;
  question: string;
  tailoredResume: string;
  tailoredCoverLetter?: string;
  positionTitle?: string;
  companyName?: string;
  jobDescription?: string;
  limitType?: "words" | "characters";
  limitValue?: number;
}

export function buildGeneralQuestionUserPrompt(data: QuestionData): string {
  const limitInstruction =
    data.limitType && data.limitValue
      ? `\nIMPORTANT: Answer MUST be within ${data.limitValue} ${data.limitType}.`
      : "";

  return `## CANDIDATE MASTER CONTEXT:
${data.masterContext}

## QUESTION:
${data.question}

## APPLICATION CONTEXT:
### Tailored Resume:
${data.tailoredResume}

### Tailored Cover Letter:
${data.tailoredCoverLetter || "Not provided"}

### Target: ${data.positionTitle || "Not specified"} at ${data.companyName || "Not specified"}

### Job Description:
${data.jobDescription || "Not provided"}

## INSTRUCTIONS:
Answer in FIRST PERSON ("I", "my", "me"). Use Master Context for accurate details. Follow tone rules from system instructions. Answer directly and concisely. If information is not in the context, state that honestly. Do NOT fabricate information.${limitInstruction}`;
}

export function buildInternetQuestionUserPrompt(data: QuestionData): string {
  const limitInstruction =
    data.limitType && data.limitValue
      ? `\nIMPORTANT: Answer MUST be within ${data.limitValue} ${data.limitType}.`
      : "";

  return `## CANDIDATE MASTER CONTEXT:
${data.masterContext}

## QUESTION (use internet for external facts, context for personal details):
${data.question}

## APPLICATION CONTEXT:
### Tailored Resume:
${data.tailoredResume}

### Tailored Cover Letter:
${data.tailoredCoverLetter || "Not provided"}

### Target: ${data.positionTitle || "Not specified"} at ${data.companyName || "Not specified"}

### Job Description:
${data.jobDescription || "Not provided"}

## INSTRUCTIONS:
Answer in FIRST PERSON. Use Master Context for personal details. Use your training knowledge for external facts (company info, industry trends, market data). Clearly distinguish between personal experience and external information. Follow tone rules from system instructions.${limitInstruction}`;
}
