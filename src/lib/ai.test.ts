// ========================================
// COMPREHENSIVE TEST SUITE — AI Module
// ========================================

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { DeepSeekProvider } from "./ai-providers/deepseek";
import * as ai from "./ai";

// ========================================
// TEST DATA
// ========================================

const SAMPLE_LATEX = String.raw`\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Software Engineer} at Acme Corp
\begin{itemize}
\item Built REST API with Node.js
\end{itemize}
\section{Skills}
JavaScript, React, AWS
\end{document}`;

// ========================================
// FETCH MOCK HELPERS — for DeepSeekProvider unit tests
// ========================================

type MockFetch = (url: string, init: RequestInit) => Promise<Response>;

function fakeResponse(overrides: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body: unknown;
}) {
  const { ok = true, status = 200, statusText = "OK", body } = overrides;
  return {
    ok,
    status,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

function successBody(content: string) {
  return {
    id: "test-id",
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  };
}

// ========================================
// PROTOTYPE MOCK HELPERS — for AI module tests
// ========================================

let prototypeSpy: ReturnType<typeof spyOn> | null = null;

function mockGenerateContent(response: string) {
  restoreGenerateContent();
  prototypeSpy = spyOn(DeepSeekProvider.prototype, "generateContent").mockResolvedValue(response);
}

function mockGenerateContentReject(error: Error) {
  restoreGenerateContent();
  prototypeSpy = spyOn(DeepSeekProvider.prototype, "generateContent").mockRejectedValue(error);
}

function mockGenerateContentDynamic(
  fn: (prompt: string, systemPrompt?: string) => string | Promise<string>,
) {
  restoreGenerateContent();
  prototypeSpy = spyOn(DeepSeekProvider.prototype, "generateContent").mockImplementation(
    fn as (prompt: string, systemPrompt?: string) => Promise<string>,
  );
}

function restoreGenerateContent() {
  if (prototypeSpy) {
    prototypeSpy.mockRestore();
    prototypeSpy = null;
  }
}

// ========================================
// DeepSeekProvider UNIT TESTS
// ========================================

describe("DeepSeekProvider", () => {
  let fetchMock: MockFetch;

  function createProvider(overrides: Record<string, unknown> = {}) {
    return new DeepSeekProvider({
      temperature: 0.7,
      maxTokens: 65535,
      thinking: { type: "enabled", reasoning_effort: "high" },
      ...overrides,
      _fetch: fetchMock,
    } as unknown as ConstructorParameters<typeof DeepSeekProvider>[0]);
  }

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-api-key";
    fetchMock = async () => fakeResponse({ body: successBody("ok") });
  });

  describe("generateContent — success", () => {
    it("returns text content from API response", async () => {
      fetchMock = async () => fakeResponse({ body: successBody("Hello from DeepSeek") });
      const provider = createProvider();
      const result = await provider.generateContent("Say hello");
      expect(result).toBe("Hello from DeepSeek");
    });

    it("handles empty response content", async () => {
      fetchMock = async () => fakeResponse({ body: successBody("") });
      const provider = createProvider();
      const result = await provider.generateContent("test");
      expect(result).toBe("");
    });

    it("handles multi-line LaTeX response", async () => {
      fetchMock = async () => fakeResponse({ body: successBody(SAMPLE_LATEX) });
      const provider = createProvider();
      const result = await provider.generateContent("Tailor this resume");
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("handles very long response (100k chars)", async () => {
      const longResponse = "A".repeat(100000);
      fetchMock = async () => fakeResponse({ body: successBody(longResponse) });
      const provider = createProvider();
      const result = await provider.generateContent("Generate long text");
      expect(result).toBe(longResponse);
      expect(result.length).toBe(100000);
    });

    it("sends thinking config when enabled", async () => {
      let capturedBody: Record<string, unknown> = {};
      fetchMock = async (_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse({ body: successBody("response") });
      };
      const provider = createProvider();
      await provider.generateContent("test");
      expect(capturedBody.thinking).toEqual({ type: "enabled", reasoning_effort: "high" });
    });

    it("uses correct model name", async () => {
      let capturedBody: Record<string, unknown> = {};
      fetchMock = async (_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse({ body: successBody("response") });
      };
      const provider = createProvider();
      await provider.generateContent("test");
      expect(capturedBody.model).toBe("deepseek-v4-flash");
    });

    it("calls correct API endpoint", async () => {
      let capturedUrl = "";
      fetchMock = async (url: string) => {
        capturedUrl = url;
        return fakeResponse({ body: successBody("response") });
      };
      const provider = createProvider();
      await provider.generateContent("test");
      expect(capturedUrl).toBe("https://api.deepseek.com/chat/completions");
    });

    it("sends correct Authorization header", async () => {
      let capturedHeaders: Record<string, string> = {};
      fetchMock = async (_url, init) => {
        capturedHeaders = init.headers as Record<string, string>;
        return fakeResponse({ body: successBody("response") });
      };
      const provider = createProvider();
      await provider.generateContent("test");
      expect(capturedHeaders.Authorization).toBe("Bearer test-api-key");
    });
  });

  describe("generateContent — errors", () => {
    it("throws on 400 Bad Request", async () => {
      fetchMock = async () =>
        fakeResponse({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          body: { error: "Bad Request" },
        });
      const provider = createProvider();
      await expect(provider.generateContent("test")).rejects.toThrow("DeepSeek API error");
    });

    it("throws on 401 Unauthorized", async () => {
      fetchMock = async () =>
        fakeResponse({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          body: { error: "Unauthorized" },
        });
      const provider = createProvider();
      await expect(provider.generateContent("test")).rejects.toThrow("DeepSeek API error");
    });

    it("throws on 403 Forbidden", async () => {
      fetchMock = async () =>
        fakeResponse({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          body: { error: "Forbidden" },
        });
      const provider = createProvider();
      await expect(provider.generateContent("test")).rejects.toThrow("DeepSeek API error");
    });

    it("throws on missing API key", async () => {
      delete process.env.DEEPSEEK_API_KEY;
      const provider = createProvider();
      await expect(provider.generateContent("test")).rejects.toThrow(
        "DeepSeek API key not configured",
      );
    });

    it("throws on invalid input — excessive repetition", async () => {
      const provider = createProvider();
      await expect(provider.generateContent("a".repeat(200))).rejects.toThrow("Invalid input");
    });

    it("throws on null input", async () => {
      const provider = createProvider();
      await expect(provider.generateContent(null as unknown as string)).rejects.toThrow(
        "Invalid input",
      );
    });

    it("throws on undefined input", async () => {
      const provider = createProvider();
      await expect(provider.generateContent(undefined as unknown as string)).rejects.toThrow(
        "Invalid input",
      );
    });

    it("throws on empty string input", async () => {
      const provider = createProvider();
      await expect(provider.generateContent("")).rejects.toThrow("Invalid input");
    });

    it("throws on bidirectional unicode override chars", async () => {
      const provider = createProvider();
      await expect(provider.generateContent("\u202Etest")).rejects.toThrow("Invalid input");
    });
  });

  describe("generateContent — retries", () => {
    it("retries on 503 and succeeds on 2nd attempt", async () => {
      let callCount = 0;
      fetchMock = async () => {
        callCount++;
        if (callCount === 1) {
          return fakeResponse({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            body: { error: "server error" },
          });
        }
        return fakeResponse({ body: successBody("recovered") });
      };
      const provider = createProvider();
      const result = await provider.generateContent("test");
      expect(result).toBe("recovered");
      expect(callCount).toBe(2);
    });

    it("retries on 429 and succeeds on 2nd attempt", async () => {
      let callCount = 0;
      fetchMock = async () => {
        callCount++;
        if (callCount === 1) {
          return fakeResponse({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            body: { error: "rate limit exceeded" },
          });
        }
        return fakeResponse({ body: successBody("rate limit recovered") });
      };
      const provider = createProvider();
      const result = await provider.generateContent("test");
      expect(result).toBe("rate limit recovered");
      expect(callCount).toBe(2);
    });

    it("retries on network error and succeeds on 2nd attempt", async () => {
      let callCount = 0;
      fetchMock = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("connection reset");
        }
        return fakeResponse({ body: successBody("network recovered") });
      };
      const provider = createProvider();
      const result = await provider.generateContent("test");
      expect(result).toBe("network recovered");
      expect(callCount).toBe(2);
    });

    it("fails after max retries (4 attempts total)", async () => {
      const delays: number[] = [];
      const origSetTimeout = globalThis.setTimeout;
      (globalThis as Record<string, unknown>).setTimeout = ((fn: () => void, ms: number) => {
        delays.push(ms);
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout;

      let callCount = 0;
      fetchMock = async () => {
        callCount++;
        return fakeResponse({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          body: { error: "server error" },
        });
      };
      const provider = createProvider();
      await expect(provider.generateContent("test")).rejects.toThrow("DeepSeek");
      expect(callCount).toBe(4);
      expect(delays.length).toBe(3);
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);

      (globalThis as Record<string, unknown>).setTimeout = origSetTimeout;
    });

    it("does NOT retry on 400 Bad Request (non-retryable)", async () => {
      let callCount = 0;
      fetchMock = async () => {
        callCount++;
        return fakeResponse({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          body: { error: "bad request" },
        });
      };
      const provider = createProvider();
      await expect(provider.generateContent("test")).rejects.toThrow("DeepSeek");
      expect(callCount).toBe(1);
    });

    it("does NOT retry on 401 Unauthorized (non-retryable)", async () => {
      let callCount = 0;
      fetchMock = async () => {
        callCount++;
        return fakeResponse({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          body: { error: "unauthorized" },
        });
      };
      const provider = createProvider();
      await expect(provider.generateContent("test")).rejects.toThrow("DeepSeek");
      expect(callCount).toBe(1);
    });

    it("retries with exponential backoff delays", async () => {
      const delays: number[] = [];
      const origSetTimeout = globalThis.setTimeout;
      (globalThis as Record<string, unknown>).setTimeout = ((fn: () => void, ms: number) => {
        delays.push(ms);
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout;

      let callCount = 0;
      fetchMock = async () => {
        callCount++;
        if (callCount < 4) {
          throw new Error("temporarily unavailable");
        }
        return fakeResponse({ body: successBody("ok") });
      };
      const provider = createProvider();
      await provider.generateContent("test");
      expect(delays.length).toBe(3);
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);

      (globalThis as Record<string, unknown>).setTimeout = origSetTimeout;
    });
  });

  describe("constructor config", () => {
    it("uses custom temperature and maxTokens", async () => {
      let capturedBody: Record<string, unknown> = {};
      fetchMock = async (_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse({ body: successBody("ok") });
      };
      const provider = new DeepSeekProvider({
        temperature: 0.3,
        maxTokens: 4096,
        _fetch: fetchMock as typeof fetch,
      } as ConstructorParameters<typeof DeepSeekProvider>[0]);
      await provider.generateContent("test");
      expect(capturedBody.temperature).toBe(0.3);
      expect(capturedBody.max_tokens).toBe(4096);
    });

    it("disables thinking when configured", async () => {
      let capturedBody: Record<string, unknown> = {};
      fetchMock = async (_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse({ body: successBody("ok") });
      };
      const provider = new DeepSeekProvider({
        thinking: { type: "disabled" },
        _fetch: fetchMock as typeof fetch,
      } as ConstructorParameters<typeof DeepSeekProvider>[0]);
      await provider.generateContent("test");
      expect(capturedBody.thinking).toEqual({ type: "disabled" });
    });

    it("uses json_object response format", async () => {
      let capturedBody: Record<string, unknown> = {};
      fetchMock = async (_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse({ body: successBody("{}") });
      };
      const provider = new DeepSeekProvider({
        responseFormat: { type: "json_object" },
        _fetch: fetchMock as typeof fetch,
      } as ConstructorParameters<typeof DeepSeekProvider>[0]);
      await provider.generateContent("output json");
      expect(capturedBody.response_format).toEqual({ type: "json_object" });
    });

    it("omits thinking key when not configured", async () => {
      let capturedBody: Record<string, unknown> = {};
      fetchMock = async (_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse({ body: successBody("ok") });
      };
      const provider = new DeepSeekProvider({
        temperature: 0.5,
        _fetch: fetchMock as typeof fetch,
      } as ConstructorParameters<typeof DeepSeekProvider>[0]);
      await provider.generateContent("test");
      expect(capturedBody.thinking).toBeUndefined();
    });
  });

  describe("createFast", () => {
    it("returns provider with disabled thinking and low temp", async () => {
      let capturedBody: Record<string, unknown> = {};
      fetchMock = async (_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse({ body: successBody("ok") });
      };
      // Create a fast provider with injected fetch
      const fast = new DeepSeekProvider({
        temperature: 0.1,
        maxTokens: 8192,
        thinking: { type: "disabled" },
        _fetch: fetchMock as typeof fetch,
      } as ConstructorParameters<typeof DeepSeekProvider>[0]);
      await fast.generateContent("extract");
      expect(capturedBody.temperature).toBe(0.1);
      expect(capturedBody.max_tokens).toBe(8192);
      expect(capturedBody.thinking).toEqual({ type: "disabled" });
    });

    it("createFast static method exists and returns named provider", () => {
      const fast = DeepSeekProvider.createFast();
      expect(fast.getName()).toBe("DeepSeek V4 Flash");
    });
  });

  describe("getName", () => {
    it("returns DeepSeek V4 Flash", () => {
      const provider = new DeepSeekProvider({
        _fetch: fetchMock as typeof fetch,
      } as ConstructorParameters<typeof DeepSeekProvider>[0]);
      expect(provider.getName()).toBe("DeepSeek V4 Flash");
    });
  });
});

// ========================================
// AI MODULE — Exported functions
// ========================================

describe("AI Module — exported functions", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-api-key";
  });

  afterEach(() => {
    restoreGenerateContent();
  });

  // --------------------------------------------------
  // extractJobLocationInfo
  // --------------------------------------------------
  describe("extractJobLocationInfo", () => {
    it("extracts country and work mode from JSON response", async () => {
      mockGenerateContent('{"country": "USA", "workMode": "Remote"}');
      const result = await ai.extractJobLocationInfo("Remote job in San Francisco", "Acme Corp");
      expect(result.country).toBe("USA");
      expect(result.workMode).toBe("Remote");
    });

    it("extracts Hybrid work mode", async () => {
      mockGenerateContent('{"country": "United Kingdom", "workMode": "Hybrid"}');
      const result = await ai.extractJobLocationInfo("Hybrid role in London", "UK Corp");
      expect(result.country).toBe("United Kingdom");
      expect(result.workMode).toBe("Hybrid");
    });

    it("extracts On-site work mode", async () => {
      mockGenerateContent('{"country": "Germany", "workMode": "On-site"}');
      const result = await ai.extractJobLocationInfo("On-site in Berlin", "DE GmbH");
      expect(result.country).toBe("Germany");
      expect(result.workMode).toBe("On-site");
    });

    it("defaults invalid workMode to empty string", async () => {
      mockGenerateContent('{"country": "Canada", "workMode": "InvalidMode"}');
      const result = await ai.extractJobLocationInfo("Some job", "Corp");
      expect(result.country).toBe("Canada");
      expect(result.workMode).toBe("");
    });

    it("defaults missing country to empty string", async () => {
      mockGenerateContent('{"workMode": "Remote"}');
      const result = await ai.extractJobLocationInfo("Some job", "Corp");
      expect(result.country).toBe("");
      expect(result.workMode).toBe("Remote");
    });

    it("handles completely missing JSON in response", async () => {
      mockGenerateContent("Here is some text with no JSON at all");
      const result = await ai.extractJobLocationInfo("Some job", "Corp");
      expect(result.country).toBe("");
      expect(result.workMode).toBe("");
    });

    it("handles malformed JSON in response", async () => {
      mockGenerateContent('{"country": "USA", "workMode": "Remote"');
      const result = await ai.extractJobLocationInfo("Some job", "Corp");
      expect(result.country).toBe("");
      expect(result.workMode).toBe("");
    });

    it("handles API error gracefully — returns empty", async () => {
      mockGenerateContentReject(new Error("API failure"));
      const result = await ai.extractJobLocationInfo("Some job", "Corp");
      expect(result.country).toBe("");
      expect(result.workMode).toBe("");
    });

    it("handles empty job description", async () => {
      mockGenerateContent('{"country": "USA", "workMode": "On-site"}');
      const result = await ai.extractJobLocationInfo("", "Acme Corp");
      expect(result.country).toBe("USA");
      expect(result.workMode).toBe("On-site");
    });

    it("handles empty company name", async () => {
      mockGenerateContent('{"country": "USA", "workMode": "Remote"}');
      const result = await ai.extractJobLocationInfo("Remote job", "");
      expect(result.country).toBe("USA");
      expect(result.workMode).toBe("Remote");
    });
  });

  // --------------------------------------------------
  // tailorResume
  // --------------------------------------------------
  describe("tailorResume", () => {
    it("returns cleaned LaTeX content", async () => {
      mockGenerateContent(SAMPLE_LATEX);
      const result = await ai.tailorResume(
        SAMPLE_LATEX,
        "Software Engineer JD",
        "John Doe",
        "Company Info",
      );
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("strips markdown ```latex blocks from response", async () => {
      mockGenerateContent("```latex\n" + SAMPLE_LATEX + "\n```");
      const result = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "Info");
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("strips ``` (no language) blocks from response", async () => {
      mockGenerateContent("```\n" + SAMPLE_LATEX + "\n```");
      const result = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "Info");
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("strips ** markers from response", async () => {
      mockGenerateContent(String.raw`**bold text** \textbf{correct bold}`);
      const result = await ai.tailorResume("template", "JD", "John", "Info");
      expect(result).toBe(String.raw`bold text \textbf{correct bold}`);
    });

    it("strips opening ```latex without closing backticks", async () => {
      mockGenerateContent("```latex\n" + SAMPLE_LATEX);
      const result = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "Info");
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("strips closing ``` without opening", async () => {
      mockGenerateContent(SAMPLE_LATEX + "\n```");
      const result = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "Info");
      expect(result.trimEnd()).toBe(SAMPLE_LATEX);
    });

    it("trims whitespace from result", async () => {
      mockGenerateContent("  \n" + SAMPLE_LATEX + "\n  ");
      const result = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "Info");
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("handles empty resume and returns cleaned response", async () => {
      mockGenerateContent("some content");
      const result = await ai.tailorResume("", "JD", "John", "Info");
      expect(result).toBe("some content");
    });
  });

  // --------------------------------------------------
  // tailorCoverLetter
  // --------------------------------------------------
  describe("tailorCoverLetter", () => {
    it("returns cleaned LaTeX content", async () => {
      const coverLetterLatex = String.raw`\documentclass{article}\begin{document}Cover Letter\end{document}`;
      mockGenerateContent(coverLetterLatex);
      const result = await ai.tailorCoverLetter(coverLetterLatex, "JD", "John", "Info");
      expect(result).toBe(coverLetterLatex);
    });

    it("strips ```latex and ** from response", async () => {
      const coverLetterLatex = String.raw`\documentclass{article}\begin{document}\textbf{Cover}\end{document}`;
      mockGenerateContent("```latex\n**bold** " + coverLetterLatex + "\n```");
      const result = await ai.tailorCoverLetter(coverLetterLatex, "JD", "John", "Info");
      expect(result).toBe(
        String.raw`bold \documentclass{article}\begin{document}\textbf{Cover}\end{document}`,
      );
    });
  });

  // --------------------------------------------------
  // tailorResume with manualResearch
  // --------------------------------------------------
  describe("tailorResume with manualResearch", () => {
    it("passes manualResearch alongside masterContext", async () => {
      mockGenerateContent(SAMPLE_LATEX);
      const result = await ai.tailorResume(
        SAMPLE_LATEX,
        "JD",
        "John",
        "master context here",
        "some research notes",
      );
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("handles undefined manualResearch", async () => {
      mockGenerateContent(SAMPLE_LATEX);
      const result = await ai.tailorResume(
        SAMPLE_LATEX,
        "JD",
        "John",
        "master context here",
        undefined,
      );
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("handles empty masterContext", async () => {
      mockGenerateContent(SAMPLE_LATEX);
      const result = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "", "research notes");
      expect(result).toBe(SAMPLE_LATEX);
    });
  });

  // --------------------------------------------------
  // generateAnswers
  // --------------------------------------------------
  describe("generateAnswers", () => {
    it("returns answers for questions", async () => {
      mockGenerateContent("Question: What is your experience?\nAnswer: I have 5 years...");
      const result = await ai.generateAnswers(
        "What is your experience?",
        "Resume",
        undefined,
        "JD",
        "Info",
      );
      expect(result).toContain("I have 5 years");
    });

    it("handles undefined cover letter", async () => {
      mockGenerateContent("Answer: Based on my experience...");
      const result = await ai.generateAnswers("Q1", "Resume", undefined, "JD", "Info");
      expect(result).toBe("Answer: Based on my experience...");
    });
  });

  // --------------------------------------------------
  // generateColdEmail
  // --------------------------------------------------
  describe("generateColdEmail", () => {
    it("returns cold email body", async () => {
      mockGenerateContent("Hi there,\n\nI've been following Acme Corp...");
      const result = await ai.generateColdEmail("Resume", "Cover", "JD", "Info", "SWE", "Acme");
      expect(result).toContain("Acme Corp");
    });
  });

  // --------------------------------------------------
  // generateReferenceEmail
  // --------------------------------------------------
  describe("generateReferenceEmail", () => {
    it("returns referral request email", async () => {
      mockGenerateContent("Hi [Name],\n\nI hope you're doing well...");
      const result = await ai.generateReferenceEmail(
        "Resume",
        "Cover",
        "JD",
        "Info",
        "SWE",
        "Acme",
      );
      expect(result).toContain("Hi");
    });
  });

  // --------------------------------------------------
  // REGENERATION functions
  // --------------------------------------------------
  describe("regenerateResume", () => {
    it("applies feedback and returns cleaned LaTeX", async () => {
      mockGenerateContent(SAMPLE_LATEX);
      const result = await ai.regenerateResume(
        "old content",
        "Add more impact verbs",
        SAMPLE_LATEX,
        "JD",
        "John",
        "Info",
      );
      expect(result).toBe(SAMPLE_LATEX);
    });

    it("strips markdown blocks from regenerated output", async () => {
      mockGenerateContent("```latex\n" + SAMPLE_LATEX + "\n```");
      const result = await ai.regenerateResume("old", "fix", SAMPLE_LATEX, "JD", "John", "Info");
      expect(result).toBe(SAMPLE_LATEX);
    });
  });

  describe("regenerateCoverLetter", () => {
    it("applies feedback and returns cleaned LaTeX", async () => {
      const cl = String.raw`\documentclass{article}\begin{document}CL\end{document}`;
      mockGenerateContent(cl);
      const result = await ai.regenerateCoverLetter(
        "old cl",
        "make it better",
        cl,
        "JD",
        "John",
        "Info",
      );
      expect(result).toBe(cl);
    });
  });

  describe("regenerateAnswers", () => {
    it("returns regenerated answers", async () => {
      mockGenerateContent("Question 1: ...\nAnswer: Updated answer...");
      const result = await ai.regenerateAnswers(
        "old answers",
        "fix Q1",
        "Q1",
        "Resume",
        "Cover",
        "JD",
        "Info",
      );
      expect(result).toContain("Updated answer");
    });
  });

  describe("regenerateEmail", () => {
    it("regenerates cold email", async () => {
      mockGenerateContent("Updated cold email...");
      const result = await ai.regenerateEmail(
        "coldEmail",
        "old email",
        "make it shorter",
        "Resume",
        "Cover",
        "JD",
        "Info",
        "SWE",
        "Acme",
      );
      expect(result).toContain("Updated cold email");
    });

    it("regenerates reference email", async () => {
      mockGenerateContent("Updated referral request...");
      const result = await ai.regenerateEmail(
        "referenceEmail",
        "old email",
        "be warmer",
        "Resume",
        "Cover",
        "JD",
        "Info",
        "SWE",
        "Acme",
      );
      expect(result).toContain("Updated referral request");
    });
  });

  // --------------------------------------------------
  // QUESTION ANSWERING
  // --------------------------------------------------
  describe("answerGeneralQuestion", () => {
    it("answers context-based question", async () => {
      mockGenerateContent("I have been working with React for 3 years...");
      const result = await ai.answerGeneralQuestion(
        "What is your React experience?",
        "Resume text",
        "Cover text",
        "JD",
        "Info",
        "Acme",
        "SWE",
      );
      expect(result).toContain("React");
    });

    it("includes word/character limit in prompt", async () => {
      mockGenerateContent("Short answer.");
      const result = await ai.answerGeneralQuestion(
        "Describe yourself",
        "Resume",
        "Cover",
        "JD",
        "Info",
        "Acme",
        "SWE",
        "words",
        100,
      );
      expect(result).toBe("Short answer.");
    });

    it("handles undefined limitType", async () => {
      mockGenerateContent("Answer without limits.");
      const result = await ai.answerGeneralQuestion(
        "Question?",
        "Resume",
        "Cover",
        "JD",
        "Info",
        "Acme",
        "SWE",
        undefined,
        undefined,
      );
      expect(result).toBe("Answer without limits.");
    });
  });

  describe("answerWithInternet", () => {
    it("answers with context + internet", async () => {
      mockGenerateContent("Based on my experience and market research...");
      const result = await ai.answerWithInternet(
        "What are industry trends?",
        "Resume",
        "Cover",
        "JD",
        "Info",
        "Acme",
        "SWE",
      );
      expect(result).toContain("market research");
    });
  });

  describe("answerInternetOnly", () => {
    it("answers with internet only", async () => {
      mockGenerateContent("According to recent data, the industry...");
      const result = await ai.answerInternetOnly("What is the market cap of Acme?", "Acme", "SWE");
      expect(result).toContain("industry");
    });

    it("handles missing companyName and positionTitle", async () => {
      mockGenerateContent("The answer is...");
      const result = await ai.answerInternetOnly("General question", "", "");
      expect(result).toBe("The answer is...");
    });

    it("includes limit instruction when provided", async () => {
      mockGenerateContent("Short.");
      const result = await ai.answerInternetOnly("Question", "Acme", "SWE", "characters", 50);
      expect(result).toBe("Short.");
    });
  });
});

// ========================================
// PROMPT TEMPLATE TESTS (no mocking needed)
// ========================================

import {
  getJobLocationPrompt,
  getCompanyResearchPrompt,
  getResumeTailoringPrompt,
  getCoverLetterTailoringPrompt,
  getAnswerGenerationPrompt,
  getColdEmailPrompt,
  getResumeRegenerationPrompt,
  getEmailRegenerationPrompt,
  getGeneralQuestionPrompt,
  getInternetOnlyAnswerPrompt,
} from "./prompts";

describe("Prompt Templates", () => {
  describe("getJobLocationPrompt", () => {
    it("includes job description and company name", () => {
      const prompt = getJobLocationPrompt("Software Engineer position at Acme", "Acme Corp");
      expect(prompt).toContain("Software Engineer position at Acme");
      expect(prompt).toContain("Acme Corp");
      expect(prompt).toContain("JOB DESCRIPTION");
      expect(prompt).toContain("COMPANY");
    });

    it("handles empty company name with 'Not specified'", () => {
      const prompt = getJobLocationPrompt("Job desc", "");
      expect(prompt).toContain("COMPANY: Not specified");
    });

    it("includes all 3 work mode options in output format", () => {
      const prompt = getJobLocationPrompt("JD", "Acme");
      expect(prompt).toContain("Remote");
      expect(prompt).toContain("Hybrid");
      expect(prompt).toContain("On-site");
    });
  });

  describe("getCompanyResearchPrompt (removed — returns empty)", () => {
    it("returns empty string (research step removed)", () => {
      const prompt = getCompanyResearchPrompt();
      expect(prompt).toBe("");
    });
  });

  describe("getResumeTailoringPrompt", () => {
    it("includes all 4 data blocks", () => {
      const prompt = getResumeTailoringPrompt(SAMPLE_LATEX, "JD text", "John Doe", "Company info");
      expect(prompt).toContain(SAMPLE_LATEX);
      expect(prompt).toContain("JD text");
      expect(prompt).toContain("John Doe");
      expect(prompt).toContain("Company info");
    });

    it("includes critical rules", () => {
      const prompt = getResumeTailoringPrompt(SAMPLE_LATEX, "JD", "John", "Info");
      expect(prompt).toContain("PRESERVE STRUCTURE");
      expect(prompt).toContain("REQUIREMENTS COVERAGE");
      expect(prompt).toContain("PROOF OF WORK RULE");
      expect(prompt).toContain("TRUTHFULNESS RULE");
      expect(prompt).toContain("1-PAGE CONSTRAINT (CRITICAL)");
      expect(prompt).toContain("ONE PAGE");
    });

    it("includes velocity signal verbs", () => {
      const prompt = getResumeTailoringPrompt(SAMPLE_LATEX, "JD", "John", "Info");
      expect(prompt).toContain("Migrated");
      expect(prompt).toContain("Architected");
      expect(prompt).toContain("Scaled");
    });

    it("forbids ** double asterisks for bold", () => {
      const prompt = getResumeTailoringPrompt(SAMPLE_LATEX, "JD", "John", "Info");
      expect(prompt).toContain("Do not use **double asterisks**");
    });
  });

  describe("getCoverLetterTailoringPrompt", () => {
    it("includes personality and multidisciplinary", () => {
      const prompt = getCoverLetterTailoringPrompt("cl", "JD", "John", "Info");
      expect(prompt).toContain("CANDIDATE VOICE");
      expect(prompt).toContain("multidisciplinary");
    });

    it("forbids AI cliches (tapestry, leverage, etc.)", () => {
      const prompt = getCoverLetterTailoringPrompt("cl", "JD", "John", "Info");
      expect(prompt).toContain("NO AI CLICH");
      expect(prompt).toContain("tapestry");
      expect(prompt).toContain("leverage");
    });

    it("specifies 250-350 word body range", () => {
      const prompt = getCoverLetterTailoringPrompt("cl", "JD", "John", "Info");
      expect(prompt).toContain("250-350 words");
    });
  });

  describe("getResumeRegenerationPrompt", () => {
    it("includes feedback, current content, and original", () => {
      const prompt = getResumeRegenerationPrompt(
        "Add more metrics",
        "current latex",
        "original latex",
        "JD",
        "John",
        "Info",
      );
      expect(prompt).toContain("Add more metrics");
      expect(prompt).toContain("current latex");
      expect(prompt).toContain("original latex");
      expect(prompt).toContain("JD");
      expect(prompt).toContain("John");
      expect(prompt).toContain("Info");
    });

    it("includes apply feedback and clean output rules", () => {
      const prompt = getResumeRegenerationPrompt("fix", "curr", "orig", "JD", "P", "I");
      expect(prompt).toContain("Apply the user");
      expect(prompt).toContain("USER'S FEEDBACK");
      expect(prompt).toContain("CURRENT TAILORED RESUME");
    });
  });

  describe("getGeneralQuestionPrompt", () => {
    it("includes word limit instruction when specified", () => {
      const prompt = getGeneralQuestionPrompt(
        "Question",
        "Resume",
        "Cover",
        "Position",
        "Company",
        "JD",
        "Info",
        "words",
        100,
      );
      expect(prompt).toContain("MUST be within 100 words");
    });

    it("includes character limit instruction when specified", () => {
      const prompt = getGeneralQuestionPrompt(
        "Question",
        "Resume",
        "Cover",
        "Position",
        "Company",
        "JD",
        "Info",
        "characters",
        500,
      );
      expect(prompt).toContain("MUST be within 500 characters");
    });

    it("does NOT include limit instruction when no limit specified", () => {
      const prompt = getGeneralQuestionPrompt(
        "Question",
        "Resume",
        "Cover",
        "Position",
        "Company",
        "JD",
        "Info",
      );
      expect(prompt).not.toContain("MUST be within");
    });

    it("instructs first-person writing", () => {
      const prompt = getGeneralQuestionPrompt("Q", "R", "C", "P", "Co", "JD", "I");
      expect(prompt).toContain("FIRST PERSON");
    });
  });

  describe("getColdEmailPrompt", () => {
    it("includes all context fields", () => {
      const prompt = getColdEmailPrompt(
        "SWE",
        "Acme",
        "JD",
        "Research notes",
        "Resume text",
        "Cover text",
      );
      expect(prompt).toContain("SWE");
      expect(prompt).toContain("Acme");
      expect(prompt).toContain("JD");
      expect(prompt).toContain("CANDIDATE");
    });

    it("enforces 100-200 word limit", () => {
      const prompt = getColdEmailPrompt("SWE", "Acme", "JD", "Info", "R", "C");
      expect(prompt).toContain("100-200 words");
    });

    it("truncates long resume to 2000 chars in prompt", () => {
      const longResume = "A".repeat(5000);
      const prompt = getColdEmailPrompt("SWE", "Acme", "JD", "Info", longResume, "Cover");
      expect(prompt).toContain("A".repeat(2000));
      expect(prompt).not.toContain("A".repeat(2001));
    });
  });

  describe("getInternetOnlyAnswerPrompt", () => {
    it("includes context hint when company and position provided", () => {
      const prompt = getInternetOnlyAnswerPrompt("Question?", "Acme", "SWE");
      expect(prompt).toContain("CONTEXT HINT");
      expect(prompt).toContain("SWE");
      expect(prompt).toContain("Acme");
    });

    it("does NOT include context hint when both empty", () => {
      const prompt = getInternetOnlyAnswerPrompt("Question?", "", "");
      expect(prompt).not.toContain("CONTEXT HINT");
    });
  });

  describe("getEmailRegenerationPrompt", () => {
    it("uses 'cold outreach' for coldEmail type", () => {
      const prompt = getEmailRegenerationPrompt(
        "coldEmail",
        "fix",
        "current",
        "SWE",
        "Acme",
        "JD",
        "Info",
        "Resume",
      );
      expect(prompt).toContain("cold outreach");
    });

    it("uses 'referral request' for referenceEmail type", () => {
      const prompt = getEmailRegenerationPrompt(
        "referenceEmail",
        "fix",
        "current",
        "SWE",
        "Acme",
        "JD",
        "Info",
        "Resume",
      );
      expect(prompt).toContain("referral request");
    });
  });

  describe("getAnswerGenerationPrompt", () => {
    it("includes all context blocks", () => {
      const prompt = getAnswerGenerationPrompt("Q1", "Resume", "Cover", "JD", "Master data");
      expect(prompt).toContain("Q1");
      expect(prompt).toContain("Resume");
      expect(prompt).toContain("Cover");
      expect(prompt).toContain("JD");
      expect(prompt).toContain("CANDIDATE");
    });

    it("shows 'Not provided' for undefined cover letter", () => {
      const prompt = getAnswerGenerationPrompt("Q1", "Resume", undefined, "JD", "Info");
      expect(prompt).toContain("Not provided");
    });
  });
});

// ========================================
// INTEGRATION — End-to-end flow
// ========================================

describe("Integration — end-to-end flow", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-api-key";
  });

  afterEach(() => {
    restoreGenerateContent();
  });

  it("tailors resume with master context and manual research", async () => {
    mockGenerateContent(SAMPLE_LATEX);
    const tailored = await ai.tailorResume(
      SAMPLE_LATEX,
      "Fintech JD",
      "John Doe",
      "master context data",
      "manual research notes",
    );
    expect(tailored).toBe(SAMPLE_LATEX);
  });

  it("tailors resume then regenerates with feedback", async () => {
    mockGenerateContent(SAMPLE_LATEX);
    const tailored = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "mc");

    mockGenerateContent(SAMPLE_LATEX.replace("Software Engineer", "Senior Software Engineer"));
    const regenerated = await ai.regenerateResume(
      tailored,
      "Make title senior",
      SAMPLE_LATEX,
      "JD",
      "John",
      "mc",
    );
    expect(regenerated).toContain("Senior Software Engineer");
  });

  it("tailors resume, cover letter, then generates cold email", async () => {
    mockGenerateContent(SAMPLE_LATEX);
    const tailored = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "mc");

    const cl = String.raw`\documentclass{article}\begin{document}Cover\end{document}`;
    mockGenerateContent(cl);
    const cover = await ai.tailorCoverLetter(cl, "JD", "John", "mc");

    mockGenerateContent("Hi, I'd love to join Acme...");
    const email = await ai.generateColdEmail(tailored, cover, "JD", "mc", "SWE", "Acme");
    expect(email).toContain("Acme");
  });

  it("handles concurrent requests independently", async () => {
    let count = 0;
    mockGenerateContentDynamic(() => {
      count++;
      return "response " + count;
    });

    const [r1, r2, r3] = await Promise.all([
      ai.tailorResume("a", "JD", "John", "mc"),
      ai.tailorResume("b", "JD", "John", "mc"),
      ai.tailorResume("c", "JD", "John", "mc"),
    ]);

    expect(r1).toBe("response 1");
    expect(r2).toBe("response 2");
    expect(r3).toBe("response 3");
    expect(count).toBe(3);
    expect(new Set([r1, r2, r3]).size).toBe(3);
  });

  it("handles full tail → extract → answer pipeline", async () => {
    mockGenerateContent('{"country": "USA", "workMode": "Remote"}');
    const location = await ai.extractJobLocationInfo("Remote job in SF", "Acme");
    expect(location.country).toBe("USA");
    expect(location.workMode).toBe("Remote");

    mockGenerateContent(SAMPLE_LATEX);
    const tailored = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "Info");
    expect(tailored).toBe(SAMPLE_LATEX);

    mockGenerateContent("I have 5 years of experience with React...");
    const answer = await ai.answerGeneralQuestion(
      "How many years of React?",
      tailored,
      "",
      "JD",
      "Info",
      "Acme",
      "SWE",
    );
    expect(answer).toContain("React");
  });
});

// ========================================
// EDGE CASES
// ========================================

describe("Edge cases", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-api-key";
  });

  afterEach(() => {
    restoreGenerateContent();
  });

  it("handles JSON wrapped in markdown code fence", async () => {
    mockGenerateContent('```json\n{"country": "Canada", "workMode": "On-site"}\n```');
    const result = await ai.extractJobLocationInfo("JD", "Acme");
    expect(result.country).toBe("Canada");
    expect(result.workMode).toBe("On-site");
  });

  it("handles trailing text after JSON", async () => {
    mockGenerateContent('{"country": "USA", "workMode": "Remote"}\n\nAdditional explanation...');
    const result = await ai.extractJobLocationInfo("JD", "Acme");
    expect(result.country).toBe("USA");
  });

  it("handles API response with null content (content_filter)", async () => {
    mockGenerateContent("");
    const result = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "Info");
    expect(result).toBe("");
  });

  it("handles LaTeX input with special characters ($%&)", async () => {
    const latexWithSpecials = String.raw`\documentclass{article}\begin{document}\$\%\&\%\$\end{document}`;
    mockGenerateContent(latexWithSpecials);
    const result = await ai.tailorResume(latexWithSpecials, "JD", "John", "Info");
    expect(result).toBe(latexWithSpecials);
  });

  it("handles very long job description (many repeated skills)", async () => {
    const longJd = "Requirements: " + "Python, ".repeat(1000);
    mockGenerateContent(SAMPLE_LATEX);
    const result = await ai.tailorResume(SAMPLE_LATEX, longJd, "John", "Info");
    expect(result).toBe(SAMPLE_LATEX);
  });

  it("strips ** from LaTeX output even when embedded in text", async () => {
    const withAsterisks = String.raw`\textbf{bold} **not bold** more text`;
    mockGenerateContent(withAsterisks);
    const result = await ai.tailorResume(SAMPLE_LATEX, "JD", "John", "Info");
    expect(result).not.toContain("**");
  });

  it("strips only markdown code fences, not LaTeX patterns", async () => {
    const mixed = "```\n" + String.raw`\documentclass{article}` + "\n```";
    mockGenerateContent(mixed);
    const result = await ai.tailorResume(String.raw`\documentclass{article}`, "JD", "John", "Info");
    expect(result).toBe(String.raw`\documentclass{article}`);
    expect(result).not.toContain("```");
  });

  it("handles concurrent retry interleaving without shared state", async () => {
    mockGenerateContent("r1");
    const r1 = await ai.tailorResume("a", "JD", "John", "mc");
    mockGenerateContent("r2");
    const r2 = await ai.tailorResume("b", "JD", "John", "mc");
    expect(r1).toBe("r1");
    expect(r2).toBe("r2");
  });

  it("handles error message with special characters from API", async () => {
    // extractJobLocationInfo catches errors gracefully
    mockGenerateContentReject(new Error("Bad Gateway <proxy_error>"));
    const result = await ai.extractJobLocationInfo("JD", "Acme");
    expect(result.country).toBe("");
    expect(result.workMode).toBe("");
  });

  it("handles truncated JSON from API (network cut mid-response)", async () => {
    mockGenerateContent('{"country": "USA", "wor');
    const result = await ai.extractJobLocationInfo("JD", "Acme");
    // Malformed JSON → no match → empty
    expect(result.country).toBe("");
  });
});
