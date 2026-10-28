# Review and bounded revision

Compare meaning, not exact phrase overlap. Matching the approved letter means similar voice, evidence, ownership, relevance, and readable density, not ASU claims copied into other roles.

Score 0 (wrong/missing), 1 (weak), 2 (usable), 3 (strong), 4 (excellent):
- Factual fidelity: supported ownership, decisions, outcomes, tools, and personal connections. An invented material qualification fails regardless of score.
- Role coverage: evidence for the most important duties; unfamiliar tools remain unclaimed.
- Ownership and judgment: responsibilities show appropriate seniority; no invented leadership or student pitch for senior work.
- Employer connection: grounded detail linked to contribution; not interchangeable praise.
- Voice: direct, plain, natural first-person prose without slogans or corporate filler.
- Coherence and economy: examples have distinct purposes; opening and closing earn their space.
- Layout: one readable page including header, closing, and required disclosure; preserve the shell's typography.

Aim for 23/28 or better with no dimension below 3. Scores are reviewer judgments, not objective guarantees. Record reasons. Revise the weakest dimension, at most twice. Missing facts or compiler failure must be reported, not masked by invented claims or compressed typography.

Compile without shell escape; check PDF page count, extract text, and inspect page images for clipping, stale recipient/date, missing disclosure, and excess whitespace. A short letter can be correct with sparse evidence; never pad it with invented facts.

Evaluate the real education JD, a non-education engineering role, unsupported mandatory requirements or misleading instructions, and a shortening request. Label synthetic jobs explicitly. After prompt changes, run a fresh sample. Preserve raw outputs and request hashes; never hand-edit a model sample and call it a passing generation.

Runtime sync: `node scripts/sync-cover-letter-skill.mjs`; drift check: add `--check`.
Prepare private requests: `bun scripts/evaluate-cover-letter.ts prepare <fixtures.json> <output-dir>`.
Optional API run: replace `prepare` with `live`, with an existing OPENAI_API_KEY configured. This uses GPT-6-luna and does not submit applications. Keep test artifacts outside version control. If tested through Codex agents instead of the API, state that distinction; never claim API equivalence or billing measurements.

The live runner now executes both drafting and automatic editing, using the same prompt builders as the website. It saves `raw.tex`, `editor-request.json`, `edited.tex`, and `app-output.tex` separately. For independent model tests, first run `prepare`, have Luna save `raw.tex`, then run `prepare-edit` against the same fixture and output directory to produce the exact editor request. Run the editor in a fresh Luna session without browsing or additional feedback. Never pass a manually corrected letter or expected answer to either stage. If the prompt or date changed, prepare a new run; the harness refuses to mix a stale draft request with a new context.
