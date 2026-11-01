// Private fixture format: [{ id, mode?: "regenerate", data: CoverLetterData | RegenerationData }].
// Run with Bun. Output contains personal data: choose a directory outside version control.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import {
  buildCoverLetterPrompt,
  buildCoverLetterRegenerationPrompt,
} from "../src/lib/prompts/index";
import type { CoverLetterData, RegenerationData } from "../src/lib/prompts/user";
import { OpenAIProvider } from "../src/lib/ai-providers/openai";
import { cleanCoverLetterLatex } from "../src/lib/latex";
import { buildCoverLetterEditorPrompt } from "../src/lib/prompts/cover-letter-editor";

const [mode, fixturesPath, outputPath] = process.argv.slice(2);
if (!mode || !["prepare", "prepare-edit", "live"].includes(mode) || !fixturesPath || !outputPath) {
  throw new Error(
    "Usage: bun scripts/evaluate-cover-letter.ts prepare|prepare-edit|live <fixtures.json> <output-dir>",
  );
}
if (mode === "live" && !process.env.OPENAI_API_KEY)
  throw new Error("Configure OPENAI_API_KEY to run live; never put it in fixtures.");
type Fixture = { id: string; mode?: "regenerate"; data: CoverLetterData & RegenerationData };
const fixtures: Fixture[] = JSON.parse(await readFile(fixturesPath, "utf8"));
const seen = new Set<string>();
for (const fixture of fixtures) {
  if (!/^[a-z0-9-]+$/.test(fixture.id) || seen.has(fixture.id))
    throw new Error("Fixture IDs must be unique lowercase names.");
  seen.add(fixture.id);
  const pair =
    fixture.mode === "regenerate"
      ? buildCoverLetterRegenerationPrompt(fixture.data)
      : buildCoverLetterPrompt(fixture.data);
  const request = { model: "gpt-6-luna", reasoningEffort: "high", webSearch: true, ...pair };
  const serialized = JSON.stringify(request, null, 2);
  const dir = join(resolve(outputPath), fixture.id);
  await mkdir(dir, { recursive: true });
  const saveEditorRequest = async (raw: string) => {
    const editor = {
      model: "gpt-6-luna",
      reasoningEffort: "high",
      webSearch: false,
      ...buildCoverLetterEditorPrompt(pair.user, raw),
    };
    const serializedEditor = JSON.stringify(editor, null, 2);
    await writeFile(join(dir, "editor-request.json"), serializedEditor, { flag: "wx" });
    await writeFile(
      join(dir, "editor-manifest.json"),
      JSON.stringify(
        {
          sha256: createHash("sha256").update(serializedEditor).digest("hex"),
          draftSha256: createHash("sha256").update(raw).digest("hex"),
          mode,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    return editor;
  };
  if (mode === "prepare-edit") {
    const previous = JSON.parse(await readFile(join(dir, "request.json"), "utf8"));
    if (previous.user !== pair.user || previous.system !== pair.system)
      throw new Error("Draft prompt changed. Preserve this run and prepare a fresh generation.");
    await saveEditorRequest(await readFile(join(dir, "raw.tex"), "utf8"));
    console.log(`prepare-edit: ${fixture.id} -> ${dir}`);
    continue;
  }
  // Refuse overwrites: preserve raw samples and revisions independently.
  await writeFile(join(dir, "request.json"), serialized, { flag: "wx" });
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        id: fixture.id,
        mode,
        createdAt: new Date().toISOString(),
        sha256: createHash("sha256").update(serialized).digest("hex"),
        harness: mode === "live" ? "OpenAI Responses API" : "prepared prompt; not a model run",
      },
      null,
      2,
    ),
  );
  if (mode === "live") {
    const provider = new OpenAIProvider({
      modelId: request.model,
      reasoningEffort: "high",
      webSearch: true,
      callTag: "cover-letter-eval",
    });
    const raw = await provider.generateContent(pair.user, pair.system);
    await writeFile(join(dir, "raw.tex"), raw, { flag: "wx" });
    const editor = await saveEditorRequest(raw);
    const editorProvider = new OpenAIProvider({
      modelId: editor.model,
      reasoningEffort: "high",
      webSearch: false,
      callTag: "cover-letter-edit",
    });
    const edited = await editorProvider.generateContent(editor.user, editor.system);
    await writeFile(join(dir, "edited.tex"), edited, { flag: "wx" });
    await writeFile(join(dir, "app-output.tex"), cleanCoverLetterLatex(edited), { flag: "wx" });
  }
  console.log(`${mode}: ${fixture.id} -> ${dir}`);
}
