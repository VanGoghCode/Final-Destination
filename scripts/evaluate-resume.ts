// Fixtures contain private candidate evidence. Keep fixtures and output outside Git.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { buildResumePrompt, buildResumeRegenerationPrompt } from "../src/lib/prompts/index";
import { buildResumeEditorPrompt } from "../src/lib/prompts/kirtan-resume";
import type { ResumeTailoringData, RegenerationData } from "../src/lib/prompts/user";
import { OpenAIProvider } from "../src/lib/ai-providers/openai";
import { withAIBudget } from "../src/lib/ai-providers/http";
import { cleanLatex } from "../src/lib/latex";

const [mode, fixturesPath, outputPath] = process.argv.slice(2);
if (!mode || !["prepare", "live"].includes(mode) || !fixturesPath || !outputPath) {
  throw new Error(
    "Usage: bun scripts/evaluate-resume.ts prepare|live <fixtures.json> <output-dir>",
  );
}
if (mode === "live" && !process.env.OPENAI_API_KEY)
  throw new Error("Configure OPENAI_API_KEY locally; never put keys in fixtures.");
type Fixture = {
  id: string;
  mode?: "regenerate";
  sourceUrl?: string;
  data: ResumeTailoringData & RegenerationData;
};
const fixtures: Fixture[] = JSON.parse(await readFile(fixturesPath, "utf8"));
const seen = new Set<string>();
for (const fixture of fixtures) {
  if (!/^[a-z0-9-]+$/.test(fixture.id) || seen.has(fixture.id))
    throw new Error("IDs must be unique lowercase names.");
  seen.add(fixture.id);
  const pair =
    fixture.mode === "regenerate"
      ? buildResumeRegenerationPrompt(fixture.data)
      : buildResumePrompt(fixture.data);
  const request = { model: "gpt-6-luna", reasoningEffort: "high", webSearch: false, ...pair };
  const serialized = JSON.stringify(request, null, 2);
  const dir = join(resolve(outputPath), fixture.id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "request.json"), serialized, { flag: "wx" });
  await writeFile(
    join(dir, "original.tex"),
    fixture.data.resumeLatex || fixture.data.originalLatex,
    { flag: "wx" },
  );
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        id: fixture.id,
        mode,
        sourceUrl: fixture.sourceUrl,
        createdAt: new Date().toISOString(),
        sha256: createHash("sha256").update(serialized).digest("hex"),
        harness:
          mode === "live"
            ? "OpenAI Responses API; production prompt builders, provider, shared budget and cleaner"
            : "Prepared only; not a model run",
        manualProseEdits: false,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  if (mode === "live") {
    const started = Date.now();
    await withAIBudget(285_000, async () => {
      const provider = new OpenAIProvider({
        modelId: request.model,
        reasoningEffort: "high",
        webSearch: false,
        callTag: "resume",
      });
      const raw = await provider.generateContent(pair.user, pair.system);
      await writeFile(join(dir, "raw.tex"), raw, { flag: "wx" });
      const editor = buildResumeEditorPrompt(pair.user, raw);
      await writeFile(join(dir, "editor-request.json"), JSON.stringify(editor, null, 2), {
        flag: "wx",
      });
      const editorProvider = new OpenAIProvider({
        modelId: request.model,
        reasoningEffort: "high",
        webSearch: false,
        callTag: "resume-edit",
      });
      const edited = await editorProvider.generateContent(editor.user, editor.system);
      await writeFile(join(dir, "edited.tex"), edited, { flag: "wx" });
      await writeFile(join(dir, "app-output.tex"), cleanLatex(edited), { flag: "wx" });
    });
    console.log(`${fixture.id}: completed in ${Math.round((Date.now() - started) / 1000)}s`);
  }
  console.log(`${mode}: ${fixture.id} -> ${dir}`);
}
