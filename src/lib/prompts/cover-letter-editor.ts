import { KIRTAN_COVER_LETTER_EDITOR_INSTRUCTIONS } from "./kirtan-cover-letter";

export function buildCoverLetterEditorPrompt(originalRequest: string, draft: string) {
  return {
    system: KIRTAN_COVER_LETTER_EDITOR_INSTRUCTIONS,
    user: `## ORIGINAL REQUEST AND EVIDENCE\n${originalRequest}\n\n## GENERATED DRAFT TO EDIT (not candidate evidence)\n${draft}\n\nReturn the complete final LaTeX letter after applying the editorial instructions.`,
  };
}
