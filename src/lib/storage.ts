// Local Storage Management Utility
// Handles personal details, multiple templates, and defaults

// Storage Keys
const STORAGE_KEYS = {
  PERSONAL_DETAILS: "fd_personal_details",
  RESUME_TEMPLATES: "fd_resume_templates",
  COVER_LETTER_TEMPLATES: "fd_cover_letter_templates",
  DEFAULT_RESUME: "fd_default_resume_id",
  DEFAULT_COVER_LETTER: "fd_default_cover_letter_id",
  PROFILES: "fd_profiles",
  ACTIVE_PROFILE: "fd_active_profile_id",
  // Legacy keys for migration
  LEGACY_RESUME: "resume_template_latex",
  LEGACY_COVER_LETTER: "cover_letter_template_latex",
};

// Types
export interface PersonalDetails {
  firstName: string;
  lastName: string;
}

export interface Profile {
  id: string;
  name: string; // Profile name e.g., "Software Engineer", "Cloud Engineer"
  firstName: string;
  lastName: string;
  defaultResumeId: string | null;
  defaultCoverLetterId: string | null;
  color: string; // For avatar background
  createdAt: number;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string; // e.g., "Software Engineer", "Cloud Engineer", "General"
  content: string;
  createdAt: number;
  updatedAt: number;
}

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============ Personal Details ============

export const getPersonalDetails = (): PersonalDetails | null => {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(STORAGE_KEYS.PERSONAL_DETAILS);
  if (!data) return null;
  try {
    return JSON.parse(data) as PersonalDetails;
  } catch {
    return null;
  }
};

export const savePersonalDetails = (details: PersonalDetails): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.PERSONAL_DETAILS, JSON.stringify(details));
};

export const hasPersonalDetails = (): boolean => {
  const details = getPersonalDetails();
  return !!(details?.firstName && details?.lastName);
};

// ============ Resume Templates ============

export const getResumeTemplates = (): Template[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEYS.RESUME_TEMPLATES);
  if (!data) {
    // Try to migrate from legacy storage
    const legacyResume = localStorage.getItem(STORAGE_KEYS.LEGACY_RESUME);
    if (legacyResume) {
      const migratedTemplate: Template = {
        id: generateId(),
        name: "Default Resume",
        content: legacyResume,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveResumeTemplates([migratedTemplate]);
      setDefaultResumeId(migratedTemplate.id);
      // Remove legacy key after migration
      localStorage.removeItem(STORAGE_KEYS.LEGACY_RESUME);
      return [migratedTemplate];
    }
    return [];
  }
  try {
    return JSON.parse(data) as Template[];
  } catch {
    return [];
  }
};

export const saveResumeTemplates = (templates: Template[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.RESUME_TEMPLATES, JSON.stringify(templates));
};

export const addResumeTemplate = (name: string, content: string): Template => {
  const templates = getResumeTemplates();
  const newTemplate: Template = {
    id: generateId(),
    name,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  templates.push(newTemplate);
  saveResumeTemplates(templates);
  // If this is the first template, set it as default
  if (templates.length === 1) {
    setDefaultResumeId(newTemplate.id);
  }
  return newTemplate;
};

export const updateResumeTemplate = (id: string, updates: Partial<Omit<Template, "id" | "createdAt">>): void => {
  const templates = getResumeTemplates();
  const index = templates.findIndex((t) => t.id === id);
  const existingTemplate = templates[index];
  if (index !== -1 && existingTemplate) {
    templates[index] = {
      ...existingTemplate,
      ...updates,
      updatedAt: Date.now(),
    };
    saveResumeTemplates(templates);
  }
};

export const deleteResumeTemplate = (id: string): void => {
  const templates = getResumeTemplates().filter((t) => t.id !== id);
  saveResumeTemplates(templates);
  // If deleted template was default, set a new default
  const firstTemplate = templates[0];
  if (getDefaultResumeId() === id && templates.length > 0 && firstTemplate) {
    setDefaultResumeId(firstTemplate.id);
  } else if (templates.length === 0) {
    localStorage.removeItem(STORAGE_KEYS.DEFAULT_RESUME);
  }
};

export const getDefaultResumeId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.DEFAULT_RESUME);
};

export const setDefaultResumeId = (id: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.DEFAULT_RESUME, id);
};

export const getDefaultResumeTemplate = (): Template | null => {
  const templates = getResumeTemplates();
  const defaultId = getDefaultResumeId();
  if (defaultId) {
    const defaultTemplate = templates.find((t) => t.id === defaultId);
    if (defaultTemplate) return defaultTemplate;
  }
  // Return first template if no default set
  return templates[0] ?? null;
};

// ============ Cover Letter Templates ============

export const getCoverLetterTemplates = (): Template[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEYS.COVER_LETTER_TEMPLATES);
  if (!data) {
    // Try to migrate from legacy storage
    const legacyCoverLetter = localStorage.getItem(STORAGE_KEYS.LEGACY_COVER_LETTER);
    if (legacyCoverLetter) {
      const migratedTemplate: Template = {
        id: generateId(),
        name: "Default Cover Letter",
        content: legacyCoverLetter,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveCoverLetterTemplates([migratedTemplate]);
      setDefaultCoverLetterId(migratedTemplate.id);
      // Remove legacy key after migration
      localStorage.removeItem(STORAGE_KEYS.LEGACY_COVER_LETTER);
      return [migratedTemplate];
    }
    return [];
  }
  try {
    return JSON.parse(data) as Template[];
  } catch {
    return [];
  }
};

export const saveCoverLetterTemplates = (templates: Template[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.COVER_LETTER_TEMPLATES, JSON.stringify(templates));
};

export const addCoverLetterTemplate = (name: string, content: string): Template => {
  const templates = getCoverLetterTemplates();
  const newTemplate: Template = {
    id: generateId(),
    name,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  templates.push(newTemplate);
  saveCoverLetterTemplates(templates);
  // If this is the first template, set it as default
  if (templates.length === 1) {
    setDefaultCoverLetterId(newTemplate.id);
  }
  return newTemplate;
};

export const updateCoverLetterTemplate = (id: string, updates: Partial<Omit<Template, "id" | "createdAt">>): void => {
  const templates = getCoverLetterTemplates();
  const index = templates.findIndex((t) => t.id === id);
  const existingTemplate = templates[index];
  if (index !== -1 && existingTemplate) {
    templates[index] = {
      ...existingTemplate,
      ...updates,
      updatedAt: Date.now(),
    };
    saveCoverLetterTemplates(templates);
  }
};

export const deleteCoverLetterTemplate = (id: string): void => {
  const templates = getCoverLetterTemplates().filter((t) => t.id !== id);
  saveCoverLetterTemplates(templates);
  // If deleted template was default, set a new default
  const firstTemplate = templates[0];
  if (getDefaultCoverLetterId() === id && templates.length > 0 && firstTemplate) {
    setDefaultCoverLetterId(firstTemplate.id);
  } else if (templates.length === 0) {
    localStorage.removeItem(STORAGE_KEYS.DEFAULT_COVER_LETTER);
  }
};

export const getDefaultCoverLetterId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.DEFAULT_COVER_LETTER);
};

export const setDefaultCoverLetterId = (id: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.DEFAULT_COVER_LETTER, id);
};

export const getDefaultCoverLetterTemplate = (): Template | null => {
  const templates = getCoverLetterTemplates();
  const defaultId = getDefaultCoverLetterId();
  if (defaultId) {
    const defaultTemplate = templates.find((t) => t.id === defaultId);
    if (defaultTemplate) return defaultTemplate;
  }
  // Return first template if no default set
  return templates[0] ?? null;
};

// ============ Utility Functions ============

export const clearAllStorage = (): void => {
  if (typeof window === "undefined") return;
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
};

export const hasAnyTemplates = (): boolean => {
  return getResumeTemplates().length > 0 || getCoverLetterTemplates().length > 0;
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

export const getProfiles = (): Profile[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
  if (!data) {
    // Migrate from legacy personal details
    const personalDetails = getPersonalDetails();
    if (personalDetails?.firstName && personalDetails?.lastName) {
      const defaultResumeId = getDefaultResumeId();
      const defaultCoverLetterId = getDefaultCoverLetterId();
      const migratedProfile: Profile = {
        id: generateId(),
        name: "Default",
        firstName: personalDetails.firstName,
        lastName: personalDetails.lastName,
        defaultResumeId,
        defaultCoverLetterId,
        color: PROFILE_COLORS[0] ?? "#6366f1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveProfiles([migratedProfile]);
      setActiveProfileId(migratedProfile.id);
      return [migratedProfile];
    }
    return [];
  }
  try {
    return JSON.parse(data) as Profile[];
  } catch {
    return [];
  }
};

export const saveProfiles = (profiles: Profile[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
};

export const addProfile = (
  name: string,
  firstName: string,
  lastName: string,
  defaultResumeId: string | null = null,
  defaultCoverLetterId: string | null = null
): Profile => {
  const profiles = getProfiles();
  const colorIndex = profiles.length % PROFILE_COLORS.length;
  const newProfile: Profile = {
    id: generateId(),
    name,
    firstName,
    lastName,
    defaultResumeId,
    defaultCoverLetterId,
    color: PROFILE_COLORS[colorIndex] ?? "#6366f1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  profiles.push(newProfile);
  saveProfiles(profiles);
  // If this is the first profile, set it as active
  if (profiles.length === 1) {
    setActiveProfileId(newProfile.id);
  }
  return newProfile;
};

export const updateProfile = (id: string, updates: Partial<Omit<Profile, "id" | "createdAt">>): void => {
  const profiles = getProfiles();
  const index = profiles.findIndex((p) => p.id === id);
  const existingProfile = profiles[index];
  if (index !== -1 && existingProfile) {
    profiles[index] = {
      ...existingProfile,
      ...updates,
      updatedAt: Date.now(),
    };
    saveProfiles(profiles);
  }
};

export const deleteProfile = (id: string): void => {
  const profiles = getProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  // If deleted profile was active, set a new active
  const firstProfile = profiles[0];
  if (getActiveProfileId() === id && profiles.length > 0 && firstProfile) {
    setActiveProfileId(firstProfile.id);
  } else if (profiles.length === 0) {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
  }
};

export const getActiveProfileId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
};

export const setActiveProfileId = (id: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, id);
};

export const getActiveProfile = (): Profile | null => {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  if (activeId) {
    const activeProfile = profiles.find((p) => p.id === activeId);
    if (activeProfile) return activeProfile;
  }
  // Return first profile if no active set
  return profiles[0] ?? null;
};

export const getProfileById = (id: string): Profile | null => {
  const profiles = getProfiles();
  return profiles.find((p) => p.id === id) || null;
};

export const getNextProfileColor = (): string => {
  const profiles = getProfiles();
  return PROFILE_COLORS[profiles.length % PROFILE_COLORS.length] ?? "#6366f1";
};
