/**
 * Strip LaTeX markup, return visible text content only.
 * Used to compute character budget so tailored resume stays within 1 page.
 *
 * @param latex Raw LaTeX string
 * @returns Visible text content with LaTeX commands removed
 */
export function getLatexContentText(latex: string): string {
  let text = latex;
  // 1. Remove LaTeX comments (lines starting with unescaped %)
  text = text.replace(/(?<!\\)%.*$/gm, " ");
  // 2. Remove \begin{env} and \end{env}
  text = text.replace(/\\(begin|end)\s*\{[^}]*\}/g, " ");
  // 3. Remove optional arguments \command[opt]
  text = text.replace(/\\[a-zA-Z]+\s*\[[^\]]*\]/g, " ");
  // 4. Remove \command{text} — keep text inside braces
  text = text.replace(/\\[a-zA-Z]+\s*\{([^}]*)\}/g, "$1 ");
  // 5. Remove standalone backslash commands (\\, \#, \$, \%, etc.)
  text = text.replace(/\\(?:[a-zA-Z]+|.)/g, " ");
  // 6. Remove inline math $...$
  text = text.replace(/\$[^$]*\$/g, " ");
  // 7. Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * Count visible text characters in LaTeX (excluding markup).
 */
export function getLatexContentCharCount(latex: string): number {
  return getLatexContentText(latex).length;
}

/**
 * Compute character budget: floor = target - tolerance%, target = original count, limit = target + tolerance%.
 * Returns { floor, target, limit } where all are character counts.
 * AI must stay between floor and limit to preserve the template's original length.
 */
export function getLatexCharBudget(
  latex: string,
  tolerancePercent = 5,
): { floor: number; target: number; limit: number } {
  const target = getLatexContentCharCount(latex);
  const floor = Math.max(0, Math.round(target * (1 - tolerancePercent / 100)));
  const limit = Math.round(target * (1 + tolerancePercent / 100));
  return { floor, target, limit };
}
