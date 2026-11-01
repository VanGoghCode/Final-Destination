/** Conservative text-length guidance, not a substitute for rendering the PDF. */
export function buildResumeSpaceGuidance(latex: string): string {
  const body = latex.split(/\\begin\{document\}/)[1] || latex;
  const readable = (value: string) =>
    value
      .replace(/(?<!\\)%[^\r\n]*/g, "")
      .replace(/\\href\{[^}]*\}/g, "")
      .replace(/\\(?:begin|end)\{[^}]*\}/g, "")
      .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
      .replace(/\\([&%$#_{}])/g, "$1")
      .replace(/[{}]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const lists = [
    ...body.matchAll(/\\begin\{(ResumeBullets|itemize)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g),
  ];
  if (!lists.length)
    return "Use the original overall page density and redistribute space as needed; no automatic text-length estimate is available for this template.";
  const groups = lists.map((match) =>
    match[2]!
      .split(/\\item(?:\[[^\]]*\])?/)
      .slice(1)
      .map((item) => readable(item).length)
      .filter(Boolean),
  );
  const lengths = groups.flat();
  if (!lengths.length) return "No visible bullets were found for a text-length estimate.";
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const lineReference = Math.floor(Math.max(...lengths) * 0.95);
  return [
    `Original bullet text: ${lengths.length} bullets, ${total} readable characters including spaces across all groups. This is a shared starting space estimate, not an instruction to preserve original counts. Apply the required 4-6 bullets per experience and 3 per retained project.`,
    `A shorter-bullet reference is about ${lineReference} characters; this is not a measured line width or a hard cap. Longer bullets may use two substantive lines. Slight page overflow is acceptable; do not treat this reference as a reason to cut useful detail.`,
    "Redistribute space across skills, experience and projects. An optional project can be removed to expand stronger experience. Account for headings and wrapping; do not assume character counts guarantee page fit.",
    ...groups.map(
      (group, index) =>
        `Original group ${index + 1} lengths (observations only): ${group.join(", ")}.`,
    ),
  ].join("\n");
}
