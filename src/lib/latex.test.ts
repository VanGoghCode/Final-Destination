import { describe, expect, it } from "bun:test";
import { compileLatex, cleanLatex, LatexError } from "./latex";

const source = String.raw`\documentclass{article}\begin{document}Built APIs\end{document}`;
const pdf = () =>
  new Response("%PDF-1.7\nfixture", { headers: { "Content-Type": "application/pdf" } });
const failure = () =>
  Response.json({ logs: "! Undefined control sequence.\nl.4 \\badcommand" }, { status: 400 });

describe("LaTeX compilation and automatic repair", () => {
  it("switches compiler for fontspec engine errors without rewriting the template", async () => {
    const engines: string[] = [];
    await compileLatex(source, {
      fetch: async (_url, init) => {
        engines.push(JSON.parse(String(init?.body)).compiler);
        return engines.length === 1
          ? Response.json(
              { logs: "! The fontspec package requires either XeTeX or LuaTeX." },
              { status: 400 },
            )
          : pdf();
      },
      repair: async () => {
        throw Error("unexpected repair");
      },
    });
    expect(engines).toEqual(["pdflatex", "xelatex"]);
  });
  it("supports explicit engine hints and rejects changes to URLs or metrics", async () => {
    let engine = "";
    await compileLatex(`%!TEX program = lualatex\n${source}`, {
      fetch: async (_url, init) => {
        engine = JSON.parse(String(init?.body)).compiler;
        return pdf();
      },
    });
    expect(engine).toBe("lualatex");
    const withMetrics = source.replace(
      "Built APIs",
      String.raw`Built APIs, reduced latency 10\%. \href{https://example.com/a-b}{Portfolio}`,
    );
    for (const repair of [withMetrics.replace("10\\%", "10"), withMetrics.replace("/a-b", "/a/b")])
      await expect(
        compileLatex(withMetrics, { fetch: async () => failure(), repair: async () => repair }),
      ).rejects.toThrow("changed the document text");
  });
  it("cleans CRLF fences without changing LaTeX", () => {
    expect(cleanLatex(`  \n\`\`\`latex\r\n${source}\r\n\`\`\`  `)).toBe(source);
  });
  it("returns matching source and a verified PDF without an AI call", async () => {
    const result = await compileLatex(source, {
      fetch: async () => pdf(),
      repair: async () => {
        throw Error("unexpected repair");
      },
    });
    expect(result.latex).toBe(source);
    expect(atob(result.pdf).startsWith("%PDF-")).toBe(true);
  });
  it("repairs compiler syntax errors and compiles the corrected source", async () => {
    const bodies: string[] = [];
    const result = await compileLatex(source, {
      fetch: async (_url, init) => {
        bodies.push(String(init?.body));
        return bodies.length === 1 ? failure() : pdf();
      },
      repair: async (latex, logs) => {
        expect(latex).toBe(source);
        expect(logs).toContain("Undefined control");
        return `\`\`\`latex\n${source}\n\`\`\``;
      },
    });
    expect(bodies).toHaveLength(2);
    expect(result.latex).toBe(source);
  });
  it("bounds repairs and reports the final compiler diagnostic", async () => {
    let attempts = 0;
    await expect(
      compileLatex(source, {
        fetch: async () => failure(),
        repair: async () => {
          attempts++;
          return source;
        },
      }),
    ).rejects.toThrow("Undefined control");
    expect(attempts).toBe(2);
  });
  it.each([429, 503])(
    "does not spend AI tokens on compiler service errors (%s)",
    async (status) => {
      let attempts = 0;
      try {
        await compileLatex(source, {
          fetch: async () => new Response("down", { status }),
          repair: async () => {
            attempts++;
            return source;
          },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(LatexError);
        expect((error as LatexError).status).toBe(503);
      }
      expect(attempts).toBe(0);
    },
  );
  it("rejects HTML and malformed compiler responses instead of presenting a broken PDF", async () => {
    await expect(
      compileLatex(source, { fetch: async () => new Response("<html>error</html>") }),
    ).rejects.toThrow("invalid PDF");
  });
  it("does not repair aborted requests", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      compileLatex(source, {
        signal: controller.signal,
        fetch: async () => {
          throw Error("unexpected fetch");
        },
      }),
    ).rejects.toThrow();
  });
  it("preserves text in syntax repair instead of accepting invented facts", async () => {
    await expect(
      compileLatex(source, {
        fetch: async () => failure(),
        repair: async () => source.replace("Built APIs", "Built APIs saving $10 million"),
      }),
    ).rejects.toThrow("changed the document text");
  });
});
