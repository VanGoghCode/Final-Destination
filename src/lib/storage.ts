// Cloud Storage Management Utility
// Uses Upstash Redis via API - replaces localStorage

// Storage Keys
const STORAGE_KEYS = {
  PERSONAL_DETAILS: "fd_personal_details",
  RESUME_TEMPLATES: "fd_resume_templates",
  COVER_LETTER_TEMPLATES: "fd_cover_letter_templates",
  DEFAULT_RESUME: "fd_default_resume_id",
  DEFAULT_COVER_LETTER: "fd_default_cover_letter_id",
  PROFILES: "fd_profiles",
  ACTIVE_PROFILE: "fd_active_profile_id",
};

// Types
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

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============ Cloud Storage Helpers ============

async function cloudGet<T>(key: string): Promise<T | null> {
  try {
    const response = await fetch(`/api/storage?key=${encodeURIComponent(key)}`);
    if (!response.ok) return null;
    const { data } = await response.json();
    return data as T | null;
  } catch {
    return null;
  }
}

async function cloudSet<T>(key: string, value: T): Promise<void> {
  try {
    await fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  } catch (error) {
    console.error("Failed to save to cloud:", error);
  }
}

async function cloudRemove(key: string): Promise<void> {
  try {
    await fetch(`/api/storage?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Failed to remove from cloud:", error);
  }
}

// ============ Personal Details ============

export const getPersonalDetails = async (): Promise<PersonalDetails | null> => {
  return cloudGet<PersonalDetails>(STORAGE_KEYS.PERSONAL_DETAILS);
};

export const savePersonalDetails = async (
  details: PersonalDetails,
): Promise<void> => {
  await cloudSet(STORAGE_KEYS.PERSONAL_DETAILS, details);
};

export const hasPersonalDetails = async (): Promise<boolean> => {
  const details = await getPersonalDetails();
  return !!(details?.firstName && details?.lastName);
};

// ============ Resume Templates ============

export const getResumeTemplates = async (): Promise<Template[]> => {
  const data = await cloudGet<Template[]>(STORAGE_KEYS.RESUME_TEMPLATES);
  return data || [];
};

export const saveResumeTemplates = async (
  templates: Template[],
): Promise<void> => {
  await cloudSet(STORAGE_KEYS.RESUME_TEMPLATES, templates);
};

export const addResumeTemplate = async (
  name: string,
  content: string,
): Promise<Template> => {
  const templates = await getResumeTemplates();
  const newTemplate: Template = {
    id: generateId(),
    name,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  templates.push(newTemplate);
  await saveResumeTemplates(templates);
  if (templates.length === 1) {
    await setDefaultResumeId(newTemplate.id);
  }
  return newTemplate;
};

export const updateResumeTemplate = async (
  id: string,
  updates: Partial<Omit<Template, "id" | "createdAt">>,
): Promise<void> => {
  const templates = await getResumeTemplates();
  const index = templates.findIndex((t) => t.id === id);
  const existingTemplate = templates[index];
  if (index !== -1 && existingTemplate) {
    templates[index] = {
      ...existingTemplate,
      ...updates,
      updatedAt: Date.now(),
    };
    await saveResumeTemplates(templates);
  }
};

export const deleteResumeTemplate = async (id: string): Promise<void> => {
  const templates = (await getResumeTemplates()).filter((t) => t.id !== id);
  await saveResumeTemplates(templates);
  const firstTemplate = templates[0];
  const defaultId = await getDefaultResumeId();
  if (defaultId === id && templates.length > 0 && firstTemplate) {
    await setDefaultResumeId(firstTemplate.id);
  } else if (templates.length === 0) {
    await cloudRemove(STORAGE_KEYS.DEFAULT_RESUME);
  }
};

export const getDefaultResumeId = async (): Promise<string | null> => {
  return cloudGet<string>(STORAGE_KEYS.DEFAULT_RESUME);
};

export const setDefaultResumeId = async (id: string): Promise<void> => {
  await cloudSet(STORAGE_KEYS.DEFAULT_RESUME, id);
};

export const getDefaultResumeTemplate = async (): Promise<Template | null> => {
  const templates = await getResumeTemplates();
  const defaultId = await getDefaultResumeId();
  if (defaultId) {
    const defaultTemplate = templates.find((t) => t.id === defaultId);
    if (defaultTemplate) return defaultTemplate;
  }
  return templates[0] ?? null;
};

// ============ Cover Letter Templates ============

export const getCoverLetterTemplates = async (): Promise<Template[]> => {
  const data = await cloudGet<Template[]>(STORAGE_KEYS.COVER_LETTER_TEMPLATES);
  return data || [];
};

export const saveCoverLetterTemplates = async (
  templates: Template[],
): Promise<void> => {
  await cloudSet(STORAGE_KEYS.COVER_LETTER_TEMPLATES, templates);
};

export const addCoverLetterTemplate = async (
  name: string,
  content: string,
): Promise<Template> => {
  const templates = await getCoverLetterTemplates();
  const newTemplate: Template = {
    id: generateId(),
    name,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  templates.push(newTemplate);
  await saveCoverLetterTemplates(templates);
  if (templates.length === 1) {
    await setDefaultCoverLetterId(newTemplate.id);
  }
  return newTemplate;
};

export const updateCoverLetterTemplate = async (
  id: string,
  updates: Partial<Omit<Template, "id" | "createdAt">>,
): Promise<void> => {
  const templates = await getCoverLetterTemplates();
  const index = templates.findIndex((t) => t.id === id);
  const existingTemplate = templates[index];
  if (index !== -1 && existingTemplate) {
    templates[index] = {
      ...existingTemplate,
      ...updates,
      updatedAt: Date.now(),
    };
    await saveCoverLetterTemplates(templates);
  }
};

export const deleteCoverLetterTemplate = async (id: string): Promise<void> => {
  const templates = (await getCoverLetterTemplates()).filter(
    (t) => t.id !== id,
  );
  await saveCoverLetterTemplates(templates);
  const firstTemplate = templates[0];
  const defaultId = await getDefaultCoverLetterId();
  if (defaultId === id && templates.length > 0 && firstTemplate) {
    await setDefaultCoverLetterId(firstTemplate.id);
  } else if (templates.length === 0) {
    await cloudRemove(STORAGE_KEYS.DEFAULT_COVER_LETTER);
  }
};

export const getDefaultCoverLetterId = async (): Promise<string | null> => {
  return cloudGet<string>(STORAGE_KEYS.DEFAULT_COVER_LETTER);
};

export const setDefaultCoverLetterId = async (id: string): Promise<void> => {
  await cloudSet(STORAGE_KEYS.DEFAULT_COVER_LETTER, id);
};

export const getDefaultCoverLetterTemplate =
  async (): Promise<Template | null> => {
    const templates = await getCoverLetterTemplates();
    const defaultId = await getDefaultCoverLetterId();
    if (defaultId) {
      const defaultTemplate = templates.find((t) => t.id === defaultId);
      if (defaultTemplate) return defaultTemplate;
    }
    return templates[0] ?? null;
  };

// ============ Utility Functions ============

export const clearAllStorage = async (): Promise<void> => {
  await Promise.all(Object.values(STORAGE_KEYS).map((key) => cloudRemove(key)));
};

export const hasAnyTemplates = async (): Promise<boolean> => {
  const [resumes, coverLetters] = await Promise.all([
    getResumeTemplates(),
    getCoverLetterTemplates(),
  ]);
  return resumes.length > 0 || coverLetters.length > 0;
};

// ============ Profile Management ============

const PROFILE_COLORS = [
  "from-blue-500 to-blue-600",
  "from-purple-500 to-purple-600",
  "from-green-500 to-green-600",
  "from-orange-500 to-orange-600",
  "from-pink-500 to-pink-600",
  "from-teal-500 to-teal-600",
  "from-indigo-500 to-indigo-600",
  "from-red-500 to-red-600",
];

export const getProfiles = async (): Promise<Profile[]> => {
  const data = await cloudGet<Profile[]>(STORAGE_KEYS.PROFILES);
  return data || [];
};

export const saveProfiles = async (profiles: Profile[]): Promise<void> => {
  await cloudSet(STORAGE_KEYS.PROFILES, profiles);
};

export const addProfile = async (
  name: string,
  firstName: string,
  lastName: string,
  defaultResumeId: string | null = null,
  defaultCoverLetterId: string | null = null,
  avatarText?: string,
): Promise<Profile> => {
  const profiles = await getProfiles();
  const colorIndex = profiles.length % PROFILE_COLORS.length;
  const newProfile: Profile = {
    id: generateId(),
    name,
    firstName,
    avatarText,
    lastName,
    defaultResumeId,
    defaultCoverLetterId,
    color: PROFILE_COLORS[colorIndex] ?? "#6366f1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  profiles.push(newProfile);
  await saveProfiles(profiles);
  if (profiles.length === 1) {
    await setActiveProfileId(newProfile.id);
  }
  return newProfile;
};

export const updateProfile = async (
  id: string,
  updates: Partial<Omit<Profile, "id" | "createdAt">>,
): Promise<void> => {
  const profiles = await getProfiles();
  const index = profiles.findIndex((p) => p.id === id);
  const existingProfile = profiles[index];
  if (index !== -1 && existingProfile) {
    profiles[index] = {
      ...existingProfile,
      ...updates,
      updatedAt: Date.now(),
    };
    await saveProfiles(profiles);
  }
};

export const deleteProfile = async (id: string): Promise<void> => {
  const profiles = (await getProfiles()).filter((p) => p.id !== id);
  await saveProfiles(profiles);
  const firstProfile = profiles[0];
  const activeId = await getActiveProfileId();
  if (activeId === id && profiles.length > 0 && firstProfile) {
    await setActiveProfileId(firstProfile.id);
  } else if (profiles.length === 0) {
    await cloudRemove(STORAGE_KEYS.ACTIVE_PROFILE);
  }
};

export const getActiveProfileId = async (): Promise<string | null> => {
  return cloudGet<string>(STORAGE_KEYS.ACTIVE_PROFILE);
};

export const setActiveProfileId = async (id: string): Promise<void> => {
  await cloudSet(STORAGE_KEYS.ACTIVE_PROFILE, id);
};

export const getActiveProfile = async (): Promise<Profile | null> => {
  const profiles = await getProfiles();
  const activeId = await getActiveProfileId();
  if (activeId) {
    const activeProfile = profiles.find((p) => p.id === activeId);
    if (activeProfile) return activeProfile;
  }
  return profiles[0] ?? null;
};

export const getProfileById = async (id: string): Promise<Profile | null> => {
  const profiles = await getProfiles();
  return profiles.find((p) => p.id === id) || null;
};

export const getNextProfileColor = async (): Promise<string> => {
  const profiles = await getProfiles();
  return PROFILE_COLORS[profiles.length % PROFILE_COLORS.length] ?? "#6366f1";
};
