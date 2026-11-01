# Evaluation — October 27, 2026

The reference was Kirtan's final approved cover-letter PDF. Its style and factual evidence informed a fresh contract. Earlier cover-letter prompts were not reused. Tests used the website's actual prompt builders with private candidate fixtures outside the repository.

Sixteen GPT-6-luna outputs were generated through independent Codex test agents with high reasoning: five initial cases, three follow-up cases, six final domain/seniority cases, and two final real-job/revision cases. This is behavioral testing of Luna with the assembled prompts, **not a direct authenticated Responses API or live Vercel test**. The command-line environment had no configured OpenAI API key. A reproducible `prepare`/`live` runner is included for API testing with an existing key.

Observed changes across iterations:
- Removed an unnecessary finance-domain disclaimer and strengthened senior-role contribution over learning language.
- Removed saved profile advice that favored Paperlyft irrespective of the job; added candidate-approved facts from the final letter, including CreateAI use and production responsibilities.
- Made source linking explicit and retained raw model outputs and request hashes.
- Visual review found a stretched address from LaTeX `linebreak`. The website now normalizes that command to a non-justifying break for cover letters. Model outputs remain preserved; `app-output.tex` records the application transformation separately.

Final cases (all eight compiled to one page and were visually inspected):

| Case | Observed selection and behavior |
| --- | --- |
| Actual ASU senior web posting | Paperlyft operations, Braincuber/NMTSA delivery, researched managed-hosting connection; did not claim Acquia administration |
| Synthetic senior finance software | Paperlyft validation and operations; Braincuber/NMTSA stakeholder delivery; no invented banking experience or forced CCR paragraph |
| Synthetic new-grad SDE | Practical implementation and collaboration with a natural learning sentence; retained real ownership |
| Synthetic AI research engineering | Led with CCR tooling/evaluation and supported it with Paperlyft validation; no claimed publications |
| Synthetic senior cloud platform | Led with Paperlyft/AWS and Braincuber operations; omitted CCR; no invented Kubernetes or multi-region expertise |
| Synthetic graduate financial analyst | Used investigation, validation, cost tracking and stakeholder work as transferable evidence; no claimed accounting credentials |
| Actual Stripe Metronome infrastructure | Selected Paperlyft, Braincuber and NMTSA; omitted CCR; linked official product context to infrastructure responsibilities |
| ASU revision with false-claim trap | Added confirmed CreateAI/CCR connection, linked an official ASU source, and omitted requested false team-size and uptime claims |

Reviewer ratings using review.md (facts, role coverage, seniority, employer connection, voice, coherence, layout): ASU 24/28; finance software 25/28; graduate SDE 24/28; AI research 25/28; cloud 25/28; financial analyst 23/28; Stripe 25/28; ASU revision 24/28. These are editorial judgments, not hiring predictions or objective proof of optimal wording. The final letters remain more concise than the 528-word reference because the supplied website shell has a larger header and different body metrics. No sample was manually rewritten and presented as model output.

Software checks: 192 focused tests passed, TypeScript checked, changed code linted, skill metadata validated, and normal Next.js production build passed. A local stale Turbopack cache initially blocked the build; clearing only that generated cache resolved it. Both actual API route handlers were tested with a mocked OpenAI HTTP boundary and sent the hosted web-search configuration. Live search behavior was exercised by the Luna agents, not by a deployed Vercel function.

Sources for real-job tests:
- https://stripe.com/careers/listing/software-engineer-metronome-infrastructure/8231439 (actual posting, paraphrased in the private fixture)
- https://stripe.com/blog/metronome-stripe-building-the-future-of-billing (official research used by Luna)
- https://webservices.asu.edu/services/hosting
- https://ai.asu.edu/ai-tools/createai-platform

Limitations: results vary; this finite test set does not guarantee every domain or template. Employer research is bounded, not exhaustive. Qualification gaps are not filled with invented experience. One-page test results do not mean that the website automatically measures every future PDF's pagination. Existing saved drafts do not change on deployment. No application was submitted and no deployment was performed.

## Subsequent voice revision

After the user identified the Stripe research paragraph as overly artificial, the shared website prompt was revised to use ordinary professional language throughout, avoid company-report summaries and repeated fit claims, and include a concrete plain-language example. Two further independent Luna samples were generated; they improved but retained some formal phrasing. The downloadable Stripe letter was therefore edited across all body paragraphs by the primary assistant in response to the user and recompiled to one page. It is now an editorial revision, not an untouched model test output. Original raw samples and request hashes remain preserved in the private evaluation workspace. The prior eight-case ratings describe the earlier test run, not a fresh assessment of this voice revision. Seventeen endpoint/prompt integration tests passed after the initial voice-rule change.

## Autonomous drafting and editing validation

The next request explicitly required model-generated quality without the assistant rewriting a sample. Two additional real jobs were used:
- Cloudflare, Software Engineer - Platforms & Productivity: https://job-boards.greenhouse.io/cloudflare/jobs/8168623
- Datadog, Senior Software Engineer - CI/CD Security: https://careers.datadoghq.com/detail/8223819/?gh_jid=8223819

Twelve independent Luna calls tested drafting and successive editor contracts. Drafting used the application's actual prompt builders, default candidate evidence, and a paraphrase of each live JD. Editors received the exact website editor request, the original evidence, and the untouched first draft. They received no hand-written desired answer or case-specific reviewer feedback. Raw responses, request hashes, failed variants, and application-cleaned output were preserved separately outside version control. These were Codex Luna calls with high reasoning, not authenticated Responses API or deployed Vercel requests; no local API key was configured.

Observed failures informed the changes: single-pass writing retained abstract fit statements and weak extra examples; an early editor over-compressed the prose; another draft attributed a company initiative to the hiring team without evidence; a fuller revision overflowed to two pages. The final editor rechecks evidence selection and supported technical decisions, preserves company-versus-team attribution, and targets a smaller body budget. Its word target is an instruction, not a deterministic length or page-count validator.

Both final samples compiled to one page and were visually inspected with the original typography, margins, and signature. No primary-assistant prose changes were made to these samples. Cloudflare selected Paperlyft operations and cost/quality controls, CCR developer tooling, and Vctrx agent/MCP work. Datadog selected production and review experience and ownership at Braincuber; it retained company-level attribution for Turnstile. Cloudflare is the stronger application. Datadog remains an adjacent-experience application: the candidate materials do not establish senior supply-chain-security expertise. Writing cannot legitimately erase that gap.

An independent reviewer applied Zeinab's ownership, seniority, relevance, and voice criteria to intermediate samples. That review identified repeated summaries, underused technical decisions, and the unsupported team attribution. The final primary review found better evidence selection and clear production accountability, while some repetition and formal employer-summary phrasing remain. Do not treat this evaluation as proof of universally natural writing or an equally strong fit for every role.

The actual draft and revision API handlers now return the automatic editor's output, retain hosted search only in the drafting stage, and share a request-wide deadline across both calls. Mocked HTTP integration tests verify those behaviors, including failure when drafting consumes the time budget. 149 focused tests passed; TypeScript, scoped lint, skill validation, and a production build passed. An initial Windows sandbox/Turbopack worker failure was resolved by clearing only the generated cache and running the build outside the sandbox. Test mock typing errors were corrected before the passing build.

The code is ready for the user's normal push/deploy. Production authentication, latency, and hosted-search execution remain unverified on the deployed site. The second model call adds token cost and latency. The PDF preview still does not automatically measure page count or retry shortening; render checks remain necessary for unusual layouts or long content.
