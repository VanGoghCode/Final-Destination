# Resume tailoring

The website uses `src/lib/prompts/kirtan-resume.ts` for both initial generation and revisions. It replaces the old 35% rewrite ceiling. Candidate facts come from the original resume and master context; a JD or employer research can establish relevance but cannot establish experience.

The model first ranks the role's responsibilities and maps them to evidence. It can replace weak bullets with relevant work from the same employer, reorder and regroup skills, add or remove skill categories, choose 4-6 bullets per experience entry and 3 per retained project, and consolidate repetition. Optional projects can be removed to expand stronger experience; their accomplishments must never be reassigned to an employer. Removing a project is still allowed; do not keep an empty project heading. The original labels and examples are not a whitelist. It preserves the order of retained sections, employment history, dates, titles, credentials and the template's appearance. Skills should be recognizable tools or technical methods; activities such as prompt optimization and stakeholder communication should be demonstrated through work when supported, rather than copied into a skills list.

Seniority changes emphasis, not qualifications. Senior applications foreground supported decisions and responsibility. Junior applications emphasize contributions and foundations without hiding experience or changing titles. Missing expertise stays missing; a good resume cannot make an applicant eligible for every role.

## Runtime

`tailorResume` and `regenerateResume` draft and then review using the same selected provider/model. The reviewer receives original evidence, the JD, preferences, any feedback, and the generated draft. It checks relevance, factual attribution, natural wording, skills and layout instructions. Review errors surface to the caller rather than silently returning an unchecked draft.

Both calls use the existing route deadline, cancellation and generation-cost accounting. This adds one model call and latency. No extra hosting dependency or deployment secret is needed beyond the existing provider configuration. These instructions ship with the Next.js app; they are not a local Codex skill. No new web search is performed for resumes. Supplied employer research is passed through as relevance-only context.

For standard itemize and ResumeBullets templates, the user prompt includes a shared text-length estimate derived from all original bullet groups, plus a shorter-bullet reference. Unsupported layouts get an explicit fallback instead of invented measurements. Original group lengths are observations, not per-entry caps. Space can move from projects or skills into experience. These estimates are approximate: proportional fonts and wrapping still require rendering. Page fit is instructed and tested on samples, not guaranteed for arbitrary templates. There is no automatic PDF page-count enforcement in this change. The existing preview/compilation flow remains responsible for rendering.

## Repeatable live evaluation

Configure `OPENAI_API_KEY` in the local environment (never in fixtures or Git). Use private fixtures outside the repository:

```json
[
  {
    "id": "platform-role",
    "sourceUrl": "https://employer.example/jobs/role",
    "data": {
      "resumeLatex": "complete original LaTeX",
      "masterContext": "verified candidate evidence",
      "jobDescription": "actual JD",
      "personalDetails": "format and style preferences",
      "manualResearch": "optional employer context"
    }
  }
]
```

Run `bun scripts/evaluate-resume.ts live <fixtures.json> <new-output-directory>`. `prepare` saves requests without calling a model. Each live case calls GPT-6-luna through the production Responses API provider, prompt builders, shared deadline and LaTeX cleaner, and saves original input, untouched draft, review request and final output. The harness refuses to overwrite an existing run. For revision cases, set `mode` to `regenerate` and supply `originalLatex`, `currentContent` and `userComment` in data.

Compare roles with different responsibilities and seniority. Review each output against these criteria:

- **Accuracy:** Every claim has an original source, in the correct role. No invented metrics, management, security, scale, or domain expertise. This is a hard gate.
- **Relevance:** The top supported responsibilities have concrete evidence near the top of relevant entries. Selection changes when the JD changes; not every role receives the same emphasis.
- **Seniority:** Responsibility is expressed at the actual scope. Senior roles get evidence of decisions and production work; junior roles do not cause existing experience to disappear.
- **Skills:** No JD-derived capability slogans or unsupported tools. Technical work such as prompt evaluation appears in contextual bullets when supported.
- **Writing:** Specific actions and deliverables, no inflated claims, repetitive stacks or generic impact language. A candidate should be able to explain each bullet aloud.
- **Layout:** Compile the untouched app output with pdfLaTeX and inspect rendered pages. Preserve the original font, weights, margins, spacing, section order, links and page allowance. Reject clipping, overflow or crowded text.

Keep raw outputs, source URLs, prompt versions and review notes. Fix systematic weaknesses in the shared instructions and rerun generation; do not manually improve an evaluation sample and present it as model output. Mocked route tests establish integration, deadlines and failure handling, not prose quality. Live local API tests do not establish that the latest code has been deployed to Vercel.

## Fuller drafts

Prefer 5-6 supported bullets for relevant experience (four remains the minimum) and three bullets per retained project. Use available space for substantive details rather than aggressive shortening. Slight overflow beyond one page is acceptable so the candidate can trim the draft. Fonts, margins and spacing remain unchanged; no filler or invented facts should be added to fill space. Earlier one-page evaluation samples predate this preference.
