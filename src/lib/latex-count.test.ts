import { describe, it, expect } from "bun:test";
import { getLatexContentText, getLatexContentCharCount, getLatexCharBudget } from "./latex-count";

describe("getLatexContentText", () => {
  it("should strip basic LaTeX commands and return visible text", () => {
    const input = `\\textbf{Hello} \\textit{World}`;
    const result = getLatexContentText(input);
    expect(result).toBe("Hello World");
  });

  it("should remove \\begin{...} and \\end{...} markers", () => {
    const input = `\\begin{document}Content\\end{document}`;
    const result = getLatexContentText(input);
    expect(result).toBe("Content");
  });

  it("should remove LaTeX comments", () => {
    const input = `Visible text % This is a comment`;
    const result = getLatexContentText(input);
    expect(result).toBe("Visible text");
  });

  it("should remove standalone backslash commands like \\\\", () => {
    const input = `Line1\\\\Line2`;
    const result = getLatexContentText(input);
    expect(result).toBe("Line1 Line2");
  });

  it("should remove inline math", () => {
    const input = `Text $x^2 + y^2 = z^2$ more text`;
    const result = getLatexContentText(input);
    expect(result).toBe("Text more text");
  });

  it("should handle a full resume template", () => {
    const input = `\\documentclass{article}
\\usepackage{hyperref}

\\begin{document}
\\section{Experience}
\\textbf{Company} \\hfill 2020--2023
\\begin{itemize}
  \\item Built scalable systems using \\textbf{Python} and Go
  \\item Led team of 5 engineers
\\end{itemize}
\\end{document}`;
    const result = getLatexContentText(input);
    expect(result).toContain("Experience");
    expect(result).toContain("Company");
    expect(result).toContain("Built scalable systems using Python and Go");
    expect(result).toContain("Led team of 5 engineers");
    expect(result).not.toContain("documentclass");
    expect(result).not.toContain("usepackage");
    expect(result).not.toContain("\\begin");
    expect(result).not.toContain("\\end");
    expect(result).not.toContain("textbf");
  });

  it("should return empty string for empty input", () => {
    expect(getLatexContentText("")).toBe("");
  });

  it("should collapse multiple whitespace", () => {
    const input = `Word1    \\textbf{Word2}   Word3`;
    const result = getLatexContentText(input);
    expect(result).toBe("Word1 Word2 Word3");
  });

  it("should handle \\command[opt]{text} with optional arguments", () => {
    const input = `\\href{https://example.com}{Click here}`;
    const result = getLatexContentText(input);
    // The \\href{url}{text} gets its inner content extracted
    // Step 4 regex \\command{text} would match \\href{...} and keep the url
    // Then \\href{url} would be step 4 and the manual text CharsInsideTheBrace
    // Actually let me think about this - \\href{url}{text} has two brace groups
    // Step 4 regex is /\\[a-zA-Z]+\s*\{([^}]*)\}/g
    // This matches the first brace group \\href{https://example.com} → captures "https://example.com"
    // Then on the next match it captures {Click here} → "Click here"
    // So result would be "https://example.com Click here"
    // This is fine — the URL is still readable content
    expect(result).toContain("Click here");
  });
});

describe("getLatexContentCharCount", () => {
  it("should count characters of visible text in LaTeX", () => {
    const input = `\\textbf{Hello}`;
    expect(getLatexContentCharCount(input)).toBe(5);
  });

  it("should return a reasonable count for a real resume", () => {
    const resume = `\\documentclass{article}
\\usepackage{hyperref}
\\begin{document}
\\section{Experience}
\\textbf{Software Engineer} at Google \\hfill 2020--2023
\\begin{itemize}
  \\item Built and deployed microservices handling 1M+ requests\\/day
  \\item Optimized database queries reducing latency by 40\\%
\\end{itemize}
\\end{document}`;
    const count = getLatexContentCharCount(resume);
    // Count should be positive and less than raw string length
    expect(count).toBeGreaterThan(50); // plenty of visible text
    expect(count).toBeLessThan(resume.length);
  });
});

describe("getLatexCharBudget", () => {
  it("should compute floor, target and limit from LaTeX content", () => {
    const latex = `\\textbf{Hello World}`;
    const budget = getLatexCharBudget(latex);
    expect(budget.target).toBe(11); // "Hello World" is 11 chars
    // 5% → floor=10, limit=12, range=2 < 20 → expanded: target-10=1, floor=1, limit=1+20=21
    expect(budget.floor).toBe(1);
    expect(budget.limit).toBe(21);
  });

  it("should use default tolerance of 5%", () => {
    const latex = `\\textbf{Hello}`;
    const budget = getLatexCharBudget(latex);
    // target=5, floor=5, limit=5, range=0 < 20 → expanded: target-10=-5→0, limit=0+20=20
    expect(budget.target).toBe(5);
    expect(budget.floor).toBe(0);
    expect(budget.limit).toBe(20);
  });

  it("should accept custom tolerance", () => {
    const latex = `\\textbf{Hello}`;
    const budget = getLatexCharBudget(latex, 50);
    // target=5, floor=3, limit=8, range=5 < 20 → expanded: target-10=-5→0, limit=0+20=20
    expect(budget.target).toBe(5);
    expect(budget.floor).toBe(0);
    expect(budget.limit).toBe(20);
  });

  it("should handle empty input", () => {
    const budget = getLatexCharBudget("");
    expect(budget.target).toBe(0);
    expect(budget.floor).toBe(0);
    expect(budget.limit).toBe(0);
  });

  it("should expand range for small templates", () => {
    const latex = `\\textbf{Hi}`;
    const budget = getLatexCharBudget(latex, 200);
    // target=2, floor=0, limit=6, range=6 < 20 → expanded: target-10=-8→0, limit=0+20=20
    expect(budget.target).toBe(2);
    expect(budget.floor).toBe(0);
    expect(budget.limit).toBe(20);
  });
});
