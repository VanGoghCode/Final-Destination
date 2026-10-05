import {
  resumeTemplate,
  coverTemplate,
  masterContext,
  personalProfile,
} from "./personal-workspace";
export interface PersonalDetails {
  firstName: string;
  lastName: string;
}

export interface Profile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  defaultResumeId: string | null;
  defaultCoverLetterId: string | null;
  color: string;
  avatarText?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export const getPersonalDetails = async () => personalProfile;
export const getResumeTemplates = async (): Promise<Template[]> => [resumeTemplate];
export const getCoverLetterTemplates = async (): Promise<Template[]> => [coverTemplate];
export const getDefaultResumeTemplate = async () => resumeTemplate;
export const getDefaultCoverLetterTemplate = async () => coverTemplate;
export const getProfiles = async (): Promise<Profile[]> => [personalProfile];
export const getMasterContext = async () => masterContext;
