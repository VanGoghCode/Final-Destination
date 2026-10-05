// Legacy browser values are fixtures only; the personal workspace ignores them.
import type { Template, Profile } from "../storage";
export const saveResumeTemplates = async (value: Template[]) =>
  localStorage.setItem("fd_resume_templates", JSON.stringify(value));
export const saveCoverLetterTemplates = async (value: Template[]) =>
  localStorage.setItem("fd_cover_letter_templates", JSON.stringify(value));
export const saveMasterContext = async (value: string) =>
  localStorage.setItem("fd_master_context", JSON.stringify(value));
export const saveProfiles = async (value: Profile[]) =>
  localStorage.setItem("fd_profiles", JSON.stringify(value));
