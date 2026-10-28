# Website integration

This skill is the maintainable source of the website's cover-letter instructions. It is not a requirement for the end user to run Codex.

`SKILL.md` drafting block + `references/editor.md` editing block -> `scripts/sync-cover-letter-skill.mjs` -> `src/lib/prompts/kirtan-cover-letter.ts` -> drafting/regeneration and editor prompt builders -> `src/lib/ai.ts` -> OpenAI Responses API.

Both `/api/tailor-cover-letter` and the cover-letter branch of `/api/regenerate` use the contract. Queue and individual job flows pass company, role and resume evidence. Missing/empty candidate context falls back to the deployed personal profile. Existing completed letters remain saved until explicitly regenerated.

Every cover-letter request now makes two sequential model calls: research/draft, then a focused final edit. Both use the selected model (GPT-6-luna by default). The editor receives the original request and evidence plus the generated draft; it returns the final letter. No local skill runner, human rewrite, or extra button is needed. The editor has no web-search tool and preserves sources already in the letter. The existing route-wide time budget covers both calls. An editing failure propagates to the existing error handling instead of silently returning the first draft. Expect additional model latency and token cost; this is a quality pass, not a deterministic guarantee of writing quality or pagination.

For OpenAI cover-letter calls, the provider sends `tools: [{ type: "web_search" }]` and `max_tool_calls: 3` to `https://api.openai.com/v1/responses`. OpenAI executes hosted search; no local browser, Codex runtime, Python, search server, or separate search API key is needed on Vercel. The selected OpenAI model/key must have access to that tool. The default is GPT-6-luna. An explicitly selected different provider retains its capabilities and does not gain hosted OpenAI search.

The application already accepts the OpenAI key through its existing AI settings or server `OPENAI_API_KEY`. Do not expose a server key using a `NEXT_PUBLIC_` variable. The model may skip browsing for synthetic employers, user-requested offline work, unidentified employers, or sufficient supplied evidence. Search uses public employer/job information; the prompt prohibits candidate details in search queries. Official product/engineering sources inform the letter, and source links appear beside researched claims. Public research never establishes candidate product use or credentials.

Maintain and ship:

1. Edit the drafting runtime block and/or the editor contract and run `npm run cover-letter:sync`.
2. Commit both the skill and generated TypeScript, plus the server/provider, profile and caller changes. Include `scripts/sync-cover-letter-skill.mjs`: `npm run build` checks prompt synchronization in `prebuild`.
3. Push and deploy normally. The Vercel build uses the compiled TypeScript. It does not read private local evaluation fixtures or PDFs.
4. After deployment, generate a new letter with OpenAI selected or regenerate an existing one. The code-path tests verify the outgoing hosted tool configuration; a live production search still requires the deployed code and a working account/key.

Pagination: the prompt preserves typography and targets one page. Eight final test outputs were compiled and visually checked. The website's existing PDF preview compiles the generated LaTeX; it does not automatically measure page count and run a shortening loop. Changed templates or unusually long supplied requirements can still need revision. Do not claim a universal one-page guarantee from a word limit.

Official API references checked October 27, 2026:
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/models/gpt-6-luna

Hosted search has separate tool charges; the existing token-cost estimate is marked partial when a response contains search calls.
