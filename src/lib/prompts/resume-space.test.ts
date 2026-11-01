import { expect, test } from "bun:test";
import { buildResumeSpaceGuidance } from "./resume-space";

test("space estimates exclude preamble, comments, URL destinations and formatting markup", () => {
  const plain = String.raw`\begin{document}\begin{itemize}\item Built APIs for customers.\end{itemize}\end{document}`;
  const formatted = String.raw`% example list, not visible content
\begin{itemize}\item This is a long example in the preamble.\end{itemize}
\begin{document}
\begin{itemize}[leftmargin=*]
\item \textbf{Built APIs} for \href{https://example.test/long/path}{customers}. % hidden comment
\end{itemize}\end{document}`;
  expect(buildResumeSpaceGuidance(formatted)).toBe(buildResumeSpaceGuidance(plain));
  expect(buildResumeSpaceGuidance(formatted)).not.toContain("Original group 2");
});

test("all lists share space with role-specific bullet ranges; unknown layouts get no invented estimate", () => {
  const guidance = buildResumeSpaceGuidance(String.raw`\begin{document}
\begin{ResumeBullets}\item Built APIs.\item Tested APIs.\end{ResumeBullets}
\begin{itemize}\item Deployed software.\end{itemize}`);
  expect(guidance).toContain("Original bullet text: 3 bullets");
  expect(guidance).toContain("not an instruction to preserve original counts");
  expect(guidance).toContain("Original group 2 lengths");
  expect(guidance).not.toContain("at most");
  expect(buildResumeSpaceGuidance(String.raw`\custombullet{Built APIs}`)).toContain(
    "no automatic text-length estimate",
  );
});
