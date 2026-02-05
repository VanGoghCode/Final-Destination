"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Sidebar from "@/components/Sidebar";
import Button from "@/components/Button";
import { useDebouncedCallback, useCache, useAutoSave } from "@/lib/hooks";
import {
  getPersonalDetails,
  savePersonalDetails,
  getResumeTemplates,
  getCoverLetterTemplates,
  addResumeTemplate,
  addCoverLetterTemplate,
  updateResumeTemplate,
  updateCoverLetterTemplate,
  deleteResumeTemplate,
  deleteCoverLetterTemplate,
  getDefaultResumeId,
  getDefaultCoverLetterId,
  setDefaultResumeId,
  setDefaultCoverLetterId,
  getDefaultResumeTemplate,
  getDefaultCoverLetterTemplate,
  Template,
  // Profile imports
  Profile,
  getProfiles,
  addProfile,
  updateProfile,
  deleteProfile,
  getActiveProfileId,
  setActiveProfileId,
  getNextProfileColor,
} from "@/lib/storage";

// Reusable status dot component for field indicators
const FieldStatusDot = ({ filled, required = true }: { filled: boolean; required?: boolean }) => {
  const colorClass = filled
    ? "bg-green-500"
    : required
    ? "bg-red-600"
    : "bg-yellow-500";
  return <div className={`w-2.5 h-2.5 rounded-full ${colorClass} ${!filled && required ? 'animate-pulse' : ''}`} />;
};

// Reusable square icon button component
const IconButton = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className="w-7 h-7 flex items-center justify-center rounded border border-card-border hover:bg-surface-hover hover:border-primary text-muted hover:text-primary transition-colors"
    title={title}
  >
    {children}
  </button>
);

// Common icons
const SaveIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const PlusIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// List of required fields for progress tracking
const REQUIRED_FIELDS = ["resumeLatex", "jobDescription", "companyName", "positionTitle"] as const;

export default function Home() {
  const router = useRouter();
  const {
    firstName: _firstName,
    setFirstName,
    lastName: _lastName,
    setLastName,
    resumeLatex,
    setResumeLatex,
    coverLetterLatex,
    setCoverLetterLatex,
    jobDescription,
    setJobDescription,
    personalDetails,
    setPersonalDetails,
    companyInfo,
    setCompanyInfo,
    companyName,
    setCompanyName,
    companyUrl,
    setCompanyUrl,
    positionTitle,
    setPositionTitle,
    selectedResumeTemplateId,
    setSelectedResumeTemplateId,
    selectedCoverLetterTemplateId,
    setSelectedCoverLetterTemplateId,
    isResearching,
    setIsResearching,
    setTailoredResume,
    setTailoredCoverLetter,
    setJobCountry,
    setJobWorkMode,
    tailoredResume: _tailoredResume,
    isGeneratingTailored,
    setIsGeneratingTailored,
  } = useAppContext();

  const [error, setError] = useState<string | null>(null);
  const [showPersonalDetailsModal, setShowPersonalDetailsModal] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [tempFirstName, setTempFirstName] = useState("");
  const [tempLastName, setTempLastName] = useState("");
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // Template management state
  const [resumeTemplates, setResumeTemplates] = useState<Template[]>([]);
  const [coverLetterTemplates, setCoverLetterTemplates] = useState<Template[]>([]);
  const [defaultResumeId, setDefaultResumeIdState] = useState<string | null>(null);
  const [defaultCoverLetterId, setDefaultCoverLetterIdState] = useState<string | null>(null);

  // Template editing state
  const [editingTemplate, setEditingTemplate] = useState<{
    type: "resume" | "coverLetter";
    template: Template | null;
  } | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplateContent, setEditTemplateContent] = useState("");

  // Profile management state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileFormName, setProfileFormName] = useState("");
  const [profileFormFirstName, setProfileFormFirstName] = useState("");
  const [profileFormLastName, setProfileFormLastName] = useState("");
  const [profileFormResumeId, setProfileFormResumeId] = useState<string | null>(null);
  const [profileFormCoverLetterId, setProfileFormCoverLetterId] = useState<string | null>(null);
  
  // Inline template creation in profile modal
  const [showNewResumeInProfile, setShowNewResumeInProfile] = useState(false);
  const [showNewCoverLetterInProfile, setShowNewCoverLetterInProfile] = useState(false);
  const [newResumeNameInProfile, setNewResumeNameInProfile] = useState("");
  const [newResumeContentInProfile, setNewResumeContentInProfile] = useState("");
  const [newCoverLetterNameInProfile, setNewCoverLetterNameInProfile] = useState("");
  const [newCoverLetterContentInProfile, setNewCoverLetterContentInProfile] = useState("");

  // Research caching hook
  const { getFromCache: getResearchCache, setInCache: setResearchCache } = useCache<string>(
    "fd_research_cache",
    60 * 60 * 1000 // 1 hour TTL
  );

  // Auto-save draft application data
  const draftData = {
    companyName,
    companyUrl,
    positionTitle,
    jobDescription,
    personalDetails,
  };
  const { isSaving: _isAutoSaving, lastSaved: _lastAutoSaved } = useAutoSave(
    "fd_draft_application",
    draftData,
    2000 // Save after 2 seconds of inactivity
  );

  // Debounced function to clear company research
  const debouncedClearResearch = useDebouncedCallback(() => {
    if (companyInfo) {
      setCompanyInfo("");
    }
  }, 500);

  // Show notification helper
  const showNotification = (message: string) => {
    setSavedNotification(message);
    setTimeout(() => setSavedNotification(null), 2000);
  };

  // Load draft data from localStorage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("fd_draft_application");
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.companyName && !companyName) setCompanyName(draft.companyName);
        if (draft.companyUrl && !companyUrl) setCompanyUrl(draft.companyUrl);
        if (draft.positionTitle && !positionTitle) setPositionTitle(draft.positionTitle);
        if (draft.jobDescription && !jobDescription) setJobDescription(draft.jobDescription);
        if (draft.personalDetails && !personalDetails) setPersonalDetails(draft.personalDetails);
      }
    } catch (error) {
      console.error("Failed to load draft:", error);
    }
  }, []);

  // Load data from localStorage on mount
  useEffect(() => {
    // Load profiles first
    const loadedProfiles = getProfiles();
    setProfiles(loadedProfiles);
    const activeId = getActiveProfileId();
    setActiveProfileIdState(activeId);

    // Load templates
    const resumes = getResumeTemplates();
    const coverLetters = getCoverLetterTemplates();
    setResumeTemplates(resumes);
    setCoverLetterTemplates(coverLetters);
    setDefaultResumeIdState(getDefaultResumeId());
    setDefaultCoverLetterIdState(getDefaultCoverLetterId());

    // If we have an active profile, use its data
    const activeProfile = loadedProfiles.find(p => p.id === activeId);
    if (activeProfile) {
      setFirstName(activeProfile.firstName);
      setLastName(activeProfile.lastName);
      // Load profile's default resume
      if (activeProfile.defaultResumeId) {
        const profileResume = resumes.find(t => t.id === activeProfile.defaultResumeId);
        if (profileResume) {
          setResumeLatex(profileResume.content);
          setSelectedResumeTemplateId(profileResume.id);
        }
      }
      // Load profile's default cover letter
      if (activeProfile.defaultCoverLetterId) {
        const profileCoverLetter = coverLetters.find(t => t.id === activeProfile.defaultCoverLetterId);
        if (profileCoverLetter) {
          setCoverLetterLatex(profileCoverLetter.content);
          setSelectedCoverLetterTemplateId(profileCoverLetter.id);
        }
      }
    } else if (loadedProfiles.length === 0) {
      // No profiles exist - check legacy personal details
      const savedDetails = getPersonalDetails();
      if (savedDetails) {
        setFirstName(savedDetails.firstName);
        setLastName(savedDetails.lastName);
      } else {
        setShowPersonalDetailsModal(true);
      }
      // Load default templates
      if (!resumeLatex) {
        const defaultResume = getDefaultResumeTemplate();
        if (defaultResume) {
          setResumeLatex(defaultResume.content);
          setSelectedResumeTemplateId(defaultResume.id);
        }
      }
      if (!coverLetterLatex) {
        const defaultCoverLetter = getDefaultCoverLetterTemplate();
        if (defaultCoverLetter) {
          setCoverLetterLatex(defaultCoverLetter.content);
          setSelectedCoverLetterTemplateId(defaultCoverLetter.id);
        }
      }
    }
  }, []);

  const handleSavePersonalDetails = () => {
    if (!tempFirstName.trim() || !tempLastName.trim()) {
      alert("Please enter both first name and last name.");
      return;
    }
    savePersonalDetails({ firstName: tempFirstName.trim(), lastName: tempLastName.trim() });
    setFirstName(tempFirstName.trim());
    setLastName(tempLastName.trim());
    setShowPersonalDetailsModal(false);
    
    // Also create a default profile if none exist
    if (profiles.length === 0) {
      const newProfile = addProfile(
        "Default",
        tempFirstName.trim(),
        tempLastName.trim(),
        getDefaultResumeId(),
        getDefaultCoverLetterId()
      );
      setProfiles([newProfile]);
      setActiveProfileIdState(newProfile.id);
    }
  };

  // Profile handlers
  const handleSelectProfile = (profile: Profile) => {
    setActiveProfileId(profile.id);
    setActiveProfileIdState(profile.id);
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    
    // Load profile's templates
    if (profile.defaultResumeId) {
      const profileResume = resumeTemplates.find(t => t.id === profile.defaultResumeId);
      if (profileResume) {
        setResumeLatex(profileResume.content);
        setSelectedResumeTemplateId(profileResume.id);
      }
    }
    if (profile.defaultCoverLetterId) {
      const profileCoverLetter = coverLetterTemplates.find(t => t.id === profile.defaultCoverLetterId);
      if (profileCoverLetter) {
        setCoverLetterLatex(profileCoverLetter.content);
        setSelectedCoverLetterTemplateId(profileCoverLetter.id);
      }
    }
    showNotification(`Switched to ${profile.name}`);
  };

  const handleOpenNewProfile = () => {
    setEditingProfile(null);
    setProfileFormName("");
    setProfileFormFirstName("");
    setProfileFormLastName("");
    setProfileFormResumeId(null);
    setProfileFormCoverLetterId(null);
    // Reset inline template creation
    setShowNewResumeInProfile(false);
    setShowNewCoverLetterInProfile(false);
    setNewResumeNameInProfile("");
    setNewResumeContentInProfile("");
    setNewCoverLetterNameInProfile("");
    setNewCoverLetterContentInProfile("");
    setShowProfileEditor(true);
  };

  const handleOpenEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setProfileFormName(profile.name);
    setProfileFormFirstName(profile.firstName);
    setProfileFormLastName(profile.lastName);
    setProfileFormResumeId(profile.defaultResumeId);
    setProfileFormCoverLetterId(profile.defaultCoverLetterId);
    // Reset inline template creation
    setShowNewResumeInProfile(false);
    setShowNewCoverLetterInProfile(false);
    setNewResumeNameInProfile("");
    setNewResumeContentInProfile("");
    setNewCoverLetterNameInProfile("");
    setNewCoverLetterContentInProfile("");
    setShowProfileEditor(true);
  };

  const handleAddResumeInProfile = () => {
    if (!newResumeNameInProfile.trim() || !newResumeContentInProfile.trim()) return;
    const newTemplate = addResumeTemplate(newResumeNameInProfile.trim(), newResumeContentInProfile.trim());
    setResumeTemplates(getResumeTemplates());
    setProfileFormResumeId(newTemplate.id);
    setShowNewResumeInProfile(false);
    setNewResumeNameInProfile("");
    setNewResumeContentInProfile("");
    showNotification("Resume template created!");
  };

  const handleAddCoverLetterInProfile = () => {
    if (!newCoverLetterNameInProfile.trim() || !newCoverLetterContentInProfile.trim()) return;
    const newTemplate = addCoverLetterTemplate(newCoverLetterNameInProfile.trim(), newCoverLetterContentInProfile.trim());
    setCoverLetterTemplates(getCoverLetterTemplates());
    setProfileFormCoverLetterId(newTemplate.id);
    setShowNewCoverLetterInProfile(false);
    setNewCoverLetterNameInProfile("");
    setNewCoverLetterContentInProfile("");
    showNotification("Cover letter template created!");
  };

  const handleSaveProfile = () => {
    if (!profileFormName.trim() || !profileFormFirstName.trim() || !profileFormLastName.trim()) {
      alert("Please fill in profile name, first name, and last name.");
      return;
    }

    if (editingProfile) {
      // Update existing profile
      updateProfile(editingProfile.id, {
        name: profileFormName.trim(),
        firstName: profileFormFirstName.trim(),
        lastName: profileFormLastName.trim(),
        defaultResumeId: profileFormResumeId,
        defaultCoverLetterId: profileFormCoverLetterId,
      });
      // Update local state
      if (activeProfileId === editingProfile.id) {
        setFirstName(profileFormFirstName.trim());
        setLastName(profileFormLastName.trim());
      }
    } else {
      // Create new profile
      const newProfile = addProfile(
        profileFormName.trim(),
        profileFormFirstName.trim(),
        profileFormLastName.trim(),
        profileFormResumeId,
        profileFormCoverLetterId
      );
      // Select the new profile
      handleSelectProfile(newProfile);
    }
    setProfiles(getProfiles());
    setShowProfileEditor(false);
    showNotification(editingProfile ? "Profile updated!" : "Profile created!");
  };

  const handleDeleteProfile = (id: string) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    deleteProfile(id);
    setProfiles(getProfiles());
    // If deleted profile was active, switch to first available
    if (activeProfileId === id) {
      const remainingProfiles = getProfiles();
      const firstProfile = remainingProfiles[0];
      if (remainingProfiles.length > 0 && firstProfile) {
        handleSelectProfile(firstProfile);
      } else {
        setActiveProfileIdState(null);
      }
    }
    showNotification("Profile deleted!");
  };

  // Generate cache key for research
  const getResearchCacheKey = useCallback(() => {
    return `${companyName}_${positionTitle}`.toLowerCase().replace(/\s+/g, "_");
  }, [companyName, positionTitle]);

  const handleResearch = async () => {
    if (!companyName || !positionTitle || !jobDescription) {
      setError("Please fill in company name, position title, and job description.");
      return;
    }
    setError(null);

    if (companyInfo.trim()) {
      if (resumeLatex && jobDescription) {
        await triggerGenerate(companyInfo);
      }
      return;
    }

    // Check cache first
    const cacheKey = getResearchCacheKey();
    const cachedResearch = getResearchCache(cacheKey);
    if (cachedResearch) {
      console.log("[Research] Using cached research");
      setCompanyInfo(cachedResearch);
      if (resumeLatex && jobDescription) await triggerGenerate(cachedResearch);
      return;
    }

    setIsResearching(true);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, companyUrl, positionTitle, jobDescription }),
      });
      const data = await response.json();
      if (!response.ok) {
        // Handle rate limit specifically
        if (response.status === 429) {
          throw new Error(`Rate limited. Please try again in ${data.retryAfter || 60} seconds.`);
        }
        throw new Error(data.error || "Failed to research company");
      }
      
      // Cache the research result
      setResearchCache(cacheKey, data.research);
      
      setCompanyInfo(data.research);
      setIsResearching(false);
      if (resumeLatex && jobDescription) await triggerGenerate(data.research);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsResearching(false);
    }
  };

  const triggerGenerate = async (research?: string) => {
    if (!resumeLatex || !jobDescription) {
      setError("Please fill in your resume and job description.");
      return;
    }
    setError(null);
    setIsGeneratingTailored(true);

    try {
      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeLatex,
          jobDescription,
          personalDetails,
          companyInfo: research ?? companyInfo,
          companyName,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate");
      setTailoredResume(data.tailoredResume);
      setTailoredCoverLetter("");
      if (data.jobCountry) setJobCountry(data.jobCountry);
      if (data.jobWorkMode) setJobWorkMode(data.jobWorkMode);
      router.push("/tailored");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGeneratingTailored(false);
    }
  };

  const handleSelectResumeTemplate = (templateId: string) => {
    const template = resumeTemplates.find((t) => t.id === templateId);
    if (template) {
      setResumeLatex(template.content);
      setSelectedResumeTemplateId(templateId);
    }
  };

  const handleSelectCoverLetterTemplate = (templateId: string) => {
    const template = coverLetterTemplates.find((t) => t.id === templateId);
    if (template) {
      setCoverLetterLatex(template.content);
      setSelectedCoverLetterTemplateId(templateId);
    }
  };

  const handleOpenNewTemplate = (type: "resume" | "coverLetter") => {
    setEditingTemplate({ type, template: null });
    setEditTemplateName("");
    setEditTemplateContent("");
  };

  const handleOpenEditTemplate = (type: "resume" | "coverLetter", template: Template) => {
    setEditingTemplate({ type, template });
    setEditTemplateName(template.name);
    setEditTemplateContent(template.content);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    if (!editTemplateName.trim() || !editTemplateContent.trim()) {
      alert("Please provide both a name and content for the template.");
      return;
    }
    const { type, template } = editingTemplate;

    if (template) {
      if (type === "resume") {
        updateResumeTemplate(template.id, { name: editTemplateName.trim(), content: editTemplateContent });
        setResumeTemplates(getResumeTemplates());
        if (selectedResumeTemplateId === template.id) setResumeLatex(editTemplateContent);
      } else {
        updateCoverLetterTemplate(template.id, { name: editTemplateName.trim(), content: editTemplateContent });
        setCoverLetterTemplates(getCoverLetterTemplates());
        if (selectedCoverLetterTemplateId === template.id) setCoverLetterLatex(editTemplateContent);
      }
    } else {
      if (type === "resume") {
        const newTemplate = addResumeTemplate(editTemplateName.trim(), editTemplateContent);
        setResumeTemplates(getResumeTemplates());
        setDefaultResumeIdState(getDefaultResumeId());
        setResumeLatex(editTemplateContent);
        setSelectedResumeTemplateId(newTemplate.id);
      } else {
        const newTemplate = addCoverLetterTemplate(editTemplateName.trim(), editTemplateContent);
        setCoverLetterTemplates(getCoverLetterTemplates());
        setDefaultCoverLetterIdState(getDefaultCoverLetterId());
        setCoverLetterLatex(editTemplateContent);
        setSelectedCoverLetterTemplateId(newTemplate.id);
      }
    }
    setEditingTemplate(null);
    showNotification("Template saved!");
  };

  const handleDeleteTemplate = (type: "resume" | "coverLetter", id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    if (type === "resume") {
      deleteResumeTemplate(id);
      setResumeTemplates(getResumeTemplates());
      setDefaultResumeIdState(getDefaultResumeId());
      if (selectedResumeTemplateId === id) {
        const defaultTemplate = getDefaultResumeTemplate();
        if (defaultTemplate) {
          setResumeLatex(defaultTemplate.content);
          setSelectedResumeTemplateId(defaultTemplate.id);
        } else {
          setResumeLatex("");
          setSelectedResumeTemplateId("");
        }
      }
    } else {
      deleteCoverLetterTemplate(id);
      setCoverLetterTemplates(getCoverLetterTemplates());
      setDefaultCoverLetterIdState(getDefaultCoverLetterId());
      if (selectedCoverLetterTemplateId === id) {
        const defaultTemplate = getDefaultCoverLetterTemplate();
        if (defaultTemplate) {
          setCoverLetterLatex(defaultTemplate.content);
          setSelectedCoverLetterTemplateId(defaultTemplate.id);
        } else {
          setCoverLetterLatex("");
          setSelectedCoverLetterTemplateId("");
        }
      }
    }
  };

  const handleSetDefault = (type: "resume" | "coverLetter", id: string) => {
    if (type === "resume") {
      setDefaultResumeId(id);
      setDefaultResumeIdState(id);
    } else {
      setDefaultCoverLetterId(id);
      setDefaultCoverLetterIdState(id);
    }
    showNotification("Default template updated!");
  };

  const handleSaveCurrentResumeToTemplate = () => {
    if (selectedResumeTemplateId && resumeLatex) {
      updateResumeTemplate(selectedResumeTemplateId, { content: resumeLatex });
      setResumeTemplates(getResumeTemplates());
      showNotification("Resume template updated!");
    }
  };

  const handleSaveCurrentCoverLetterToTemplate = () => {
    if (selectedCoverLetterTemplateId && coverLetterLatex) {
      updateCoverLetterTemplate(selectedCoverLetterTemplateId, { content: coverLetterLatex });
      setCoverLetterTemplates(getCoverLetterTemplates());
      showNotification("Cover letter template updated!");
    }
  };

  // Progress calculation using the same required fields
  const fieldValues = { resumeLatex, jobDescription, companyName, positionTitle };
  const getProgress = () => {
    const completed = REQUIRED_FIELDS.filter((field) => !!fieldValues[field]).length;
    return { completed, total: REQUIRED_FIELDS.length };
  };

  const progress = getProgress();
  const isValid = progress.completed === progress.total;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar title="Step 1: Input">
        {/* Step Navigation */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-1">
            <div className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-primary/10 border border-primary text-primary text-xs font-medium">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">1</span>
              Input
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <button
              onClick={() => router.push("/tailored")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-xs transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-card-border text-muted flex items-center justify-center text-[10px] font-bold">2</span>
              Review
            </button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <button
              onClick={() => router.push("/questions")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-xs transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-card-border text-muted flex items-center justify-center text-[10px] font-bold">3</span>
              Q&A
            </button>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex gap-2">
            <Button
              onClick={() => setShowTemplateManager(true)}
              variant="secondary"
              className="flex-1 text-xs py-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Templates
            </Button>
            <Button
              onClick={() => window.open("/jobs", "_blank")}
              variant="secondary"
              className="flex-1 text-xs py-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM10 4h4v3h-4V4z" />
              </svg>
              Companies
            </Button>
          </div>
          <Button
            onClick={() => router.push("/batch")}
            variant="ghost"
            className="w-full text-xs py-2 border border-dashed border-primary/30 hover:border-primary hover:bg-primary/5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Batch Mode - Process Multiple Jobs
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Profiles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Profiles</label>
              <button
                onClick={handleOpenNewProfile}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-dashed border-card-border hover:border-primary text-muted hover:text-primary transition-colors"
                title="Add profile"
              >
                <PlusIcon size={10} />
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {profiles.map((profile) => (
                <div key={profile.id} className="relative group flex flex-col items-center">
                  <div className={`p-0.5 rounded-full transition-all duration-300 ease-out ${
                    activeProfileId === profile.id
                      ? "bg-linear-to-br from-primary via-primary/80 to-primary/60 shadow-md shadow-primary/30 scale-110"
                      : "bg-transparent hover:scale-105"
                  }`}>
                    <button
                      onClick={() => handleSelectProfile(profile)}
                      className={`w-10 h-10 rounded-full bg-linear-to-br ${profile.color} flex items-center justify-center text-white font-bold text-sm shadow-lg transition-all duration-300 ${
                        activeProfileId === profile.id
                          ? "ring-2 ring-white"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      title={profile.name}
                    >
                      {profile.firstName?.[0]?.toUpperCase() || "?"}{profile.lastName?.[0]?.toUpperCase() || ""}
                    </button>
                  </div>
                  {/* Edit button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditProfile(profile);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-card-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-surface-hover"
                    title="Edit profile"
                  >
                    <EditIcon size={8} />
                  </button>
                  {/* Profile name below */}
                  <span className={`mt-1 text-[10px] max-w-12.5 truncate text-center transition-colors duration-300 ${
                    activeProfileId === profile.id ? "text-primary font-medium" : "text-muted"
                  }`}>
                    {profile.name}
                  </span>
                </div>
              ))}
              {profiles.length === 0 && (
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleOpenNewProfile}
                    className="w-10 h-10 rounded-full border-2 border-dashed border-card-border flex items-center justify-center text-muted hover:border-primary hover:text-primary transition-colors"
                    title="Add your first profile"
                  >
                    <PlusIcon size={14} />
                  </button>
                  <span className="mt-1 text-[10px] text-muted">Add</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Progress</label>
            <div className="flex items-center gap-2 p-3 bg-surface-hover/50 rounded-lg">
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      i < progress.completed ? "bg-primary" : "bg-card-border"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted">{progress.completed}/4 required fields</span>
            </div>
          </div>
        </div>
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Floating Notification */}
        {savedNotification && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 fade-in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {savedNotification}
          </div>
        )}

        {/* Form Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-3 lg:space-y-5">
            {/* Resume and Cover Letter - Side by Side */}
            <div className="grid lg:grid-cols-2 gap-3 lg:gap-5">
              {/* Resume LaTeX */}
              <div className="glass-card p-3 lg:p-5 fade-in group flex flex-col">
                <div className="flex items-center justify-between mb-2 lg:mb-3">
                  <div className="flex items-center gap-2">
                    <FieldStatusDot filled={!!resumeLatex} required />
                    <label className="section-label mb-0 text-sm lg:text-base">Resume</label>
                  </div>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    {resumeTemplates.length > 0 && (
                      <select
                        value={selectedResumeTemplateId}
                        onChange={(e) => handleSelectResumeTemplate(e.target.value)}
                        className="text-xs py-1 px-2 rounded-lg border border-card-border bg-background text-foreground focus:border-primary focus:outline-none cursor-pointer"
                      >
                        <option value="">Switch template...</option>
                        {resumeTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.id === defaultResumeId ? "⭐" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedResumeTemplateId && resumeLatex && (
                      <>
                        <IconButton onClick={handleSaveCurrentResumeToTemplate} title="Save to template">
                          <SaveIcon size={12} />
                        </IconButton>
                        <IconButton 
                          onClick={() => {
                            const template = resumeTemplates.find(t => t.id === selectedResumeTemplateId);
                            if (template) handleOpenEditTemplate("resume", template);
                          }} 
                          title="Edit template"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          onClick={() => handleDeleteTemplate("resume", selectedResumeTemplateId)} 
                          title="Delete template"
                        >
                          <TrashIcon />
                        </IconButton>
                      </>
                    )}
                    <IconButton onClick={() => handleOpenNewTemplate("resume")} title="New template">
                      <PlusIcon />
                    </IconButton>
                  </div>
                </div>
                <textarea
                  className="input-field h-48 lg:h-64 font-mono text-xs resize-none overflow-y-auto"
                  placeholder="Paste your resume LaTeX code here..."
                  value={resumeLatex}
                  onChange={(e) => setResumeLatex(e.target.value)}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted">{resumeLatex.length.toLocaleString()} chars</span>
                  {resumeLatex && <span className="text-xs text-green-500">✓ Ready</span>}
                </div>
              </div>

              {/* Cover Letter LaTeX */}
              <div className="glass-card p-3 lg:p-5 fade-in group flex flex-col">
                <div className="flex items-center justify-between mb-2 lg:mb-3">
                  <div className="flex items-center gap-2">
                    <FieldStatusDot filled={!!coverLetterLatex} required={false} />
                    <label className="section-label mb-0 text-sm lg:text-base">Cover Letter</label>
                    <span className="text-xs text-muted">(optional)</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    {coverLetterTemplates.length > 0 && (
                      <select
                        value={selectedCoverLetterTemplateId}
                        onChange={(e) => handleSelectCoverLetterTemplate(e.target.value)}
                        className="text-xs py-1 px-2 rounded-lg border border-card-border bg-background text-foreground focus:border-primary focus:outline-none cursor-pointer"
                      >
                        <option value="">Switch template...</option>
                        {coverLetterTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.id === defaultCoverLetterId ? "⭐" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedCoverLetterTemplateId && coverLetterLatex && (
                      <>
                        <IconButton onClick={handleSaveCurrentCoverLetterToTemplate} title="Save to template">
                          <SaveIcon size={12} />
                        </IconButton>
                        <IconButton 
                          onClick={() => {
                            const template = coverLetterTemplates.find(t => t.id === selectedCoverLetterTemplateId);
                            if (template) handleOpenEditTemplate("coverLetter", template);
                          }} 
                          title="Edit template"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          onClick={() => handleDeleteTemplate("coverLetter", selectedCoverLetterTemplateId)} 
                          title="Delete template"
                        >
                          <TrashIcon />
                        </IconButton>
                      </>
                    )}
                    <IconButton onClick={() => handleOpenNewTemplate("coverLetter")} title="New template">
                      <PlusIcon />
                    </IconButton>
                  </div>
                </div>
                <textarea
                  className="input-field h-48 lg:h-64 font-mono text-xs resize-none overflow-y-auto"
                  placeholder="Paste your cover letter LaTeX code here..."
                  value={coverLetterLatex}
                  onChange={(e) => setCoverLetterLatex(e.target.value)}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted">{coverLetterLatex.length.toLocaleString()} chars</span>
                  {coverLetterLatex && <span className="text-xs text-green-500">✓ Ready</span>}
                </div>
              </div>
            </div>

            {/* Company Details */}
            <div className="glass-card p-3 lg:p-5 fade-in">
                <div className="flex items-center gap-2 mb-3 lg:mb-4">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <label className="section-label mb-0 text-sm lg:text-base">Company Details</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <FieldStatusDot filled={!!companyName} required />
                    <label className="text-xs font-medium text-muted uppercase tracking-wide">Company Name</label>
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Google, Microsoft..."
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      // Debounced clear of company research when company name changes
                      debouncedClearResearch();
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <FieldStatusDot filled={!!companyUrl} required={false} />
                    <label className="text-xs font-medium text-muted uppercase tracking-wide">Company URL <span className="normal-case font-normal">(optional)</span></label>
                  </div>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://..."
                    value={companyUrl}
                    onChange={(e) => {
                      setCompanyUrl(e.target.value);
                      // Debounced clear of company research when company URL changes
                      debouncedClearResearch();
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <FieldStatusDot filled={!!positionTitle} required />
                    <label className="text-xs font-medium text-muted uppercase tracking-wide">Position Title</label>
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Software Engineer..."
                    value={positionTitle}
                    onChange={(e) => {
                      setPositionTitle(e.target.value);
                      // Debounced clear of company research when position title changes
                      debouncedClearResearch();
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Job Description */}
            <div className="glass-card p-3 lg:p-5 fade-in">
              <div className="flex items-center gap-2 mb-2 lg:mb-3">
                <FieldStatusDot filled={!!jobDescription} required />
                <label className="section-label mb-0 text-sm lg:text-base">Job Description</label>
                {jobDescription && <span className="text-xs text-muted ml-auto">{jobDescription.split(/\s+/).length} words</span>}
              </div>
              <textarea
                className="input-field h-76 lg:h-102 resize-none overflow-y-auto"
                placeholder="Paste the full job description including title, responsibilities, and requirements..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            {/* Custom Instructions and Company Info - Side by Side */}
            <div className="grid lg:grid-cols-2 gap-3 lg:gap-5">
              <div className="glass-card p-3 lg:p-5 fade-in">
                <div className="flex items-center gap-2 mb-2 lg:mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <label className="section-label mb-0 text-sm lg:text-base">Custom Instructions</label>
                  <span className="text-xs text-muted">(optional)</span>
                </div>
                <textarea
                  className="input-field h-24 lg:h-28 resize-none text-sm overflow-y-auto"
                  placeholder="Emphasize leadership, focus on backend, highlight specific projects..."
                  value={personalDetails}
                  onChange={(e) => setPersonalDetails(e.target.value)}
                />
              </div>

              <div className="glass-card p-3 lg:p-5 fade-in">
                <div className="flex items-center gap-2 mb-2 lg:mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <label className="section-label mb-0 text-sm lg:text-base">Company Info</label>
                  <span className="text-xs text-muted">(auto-filled by research)</span>
                </div>
                <textarea
                  className="input-field h-24 lg:h-28 resize-none text-sm overflow-y-auto"
                  placeholder="Will be auto-filled when you click Generate..."
                  value={companyInfo}
                  onChange={(e) => setCompanyInfo(e.target.value)}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 fade-in">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Action Bar at Bottom */}
        <div className="border-t border-card-border bg-surface-hover/50 p-3 lg:p-4">
          <div className="flex flex-col items-center gap-2 lg:gap-3">
            <Button
              onClick={handleResearch}
              disabled={!isValid || isResearching || isGeneratingTailored}
              variant="primary"
              className="text-sm lg:text-base px-6 lg:px-10 py-2 lg:py-3 shadow-lg hover:shadow-xl transition-shadow"
            >
              {isResearching ? (
                <><span className="spinner" />Researching company...</>
              ) : isGeneratingTailored ? (
                <><span className="spinner" />Generating documents...</>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Generate Tailored Documents
                </>
              )}
            </Button>
            {!isValid && (
              <p className="text-muted text-sm flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  {!resumeLatex && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />}
                  {!jobDescription && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />}
                  {!companyName && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />}
                  {!positionTitle && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />}
                </span>
                {4 - progress.completed} required field{4 - progress.completed !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Personal Details Modal */}
      {showPersonalDetailsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-8 max-w-md w-full fade-in shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-linear-to-br from-primary to-primary/60 flex items-center justify-center text-white mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Welcome!</h2>
              <p className="text-muted text-sm mt-2">Enter your name to personalize your documents</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5 block">First Name</label>
                <input
                  type="text"
                  value={tempFirstName}
                  onChange={(e) => setTempFirstName(e.target.value)}
                  placeholder="John"
                  className="input-field text-center"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5 block">Last Name</label>
                <input
                  type="text"
                  value={tempLastName}
                  onChange={(e) => setTempLastName(e.target.value)}
                  placeholder="Doe"
                  className="input-field text-center"
                />
              </div>
            </div>
            <Button
              onClick={handleSavePersonalDetails}
              variant="primary"
              className="w-full py-3"
              disabled={!tempFirstName.trim() || !tempLastName.trim()}
            >
              Get Started
            </Button>
          </div>
        </div>
      )}

      {/* Template Manager Modal */}
      {showTemplateManager && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowTemplateManager(false); }}
        >
          <div className="glass-card p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto fade-in shadow-2xl">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-inherit pb-4 border-b border-card-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">Template Manager</h2>
                <p className="text-sm text-muted mt-1">Organize your resume and cover letter templates</p>
              </div>
              <button onClick={() => setShowTemplateManager(false)} className="p-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Resume Templates */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-foreground">Resumes</h3>
                    <span className="text-xs bg-surface-hover text-muted px-2 py-0.5 rounded-full">{resumeTemplates.length}</span>
                  </div>
                  <Button onClick={() => handleOpenNewTemplate("resume")} variant="primary" className="text-xs py-1.5 px-3">
                    + Add
                  </Button>
                </div>
                {resumeTemplates.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-card-border rounded-xl">
                    <p className="text-muted text-sm">No templates yet</p>
                    <button onClick={() => handleOpenNewTemplate("resume")} className="text-primary text-sm mt-1 hover:underline">Create your first</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {resumeTemplates.map((t) => (
                      <div key={t.id} className={`p-3 rounded-xl border transition-all ${t.id === defaultResumeId ? "border-primary bg-primary/5 shadow-sm" : "border-card-border hover:border-primary/30"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{t.name}</span>
                            {t.id === defaultResumeId && <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-medium">DEFAULT</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            {t.id !== defaultResumeId && (
                              <button onClick={() => handleSetDefault("resume", t.id)} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-yellow-500" title="Set default">⭐</button>
                            )}
                            <button onClick={() => handleOpenEditTemplate("resume", t)} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-primary text-xs">Edit</button>
                            <button onClick={() => handleDeleteTemplate("resume", t.id)} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-red-500 text-xs">Delete</button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted mt-1">{new Date(t.updatedAt).toLocaleDateString()} • {t.content.length.toLocaleString()} chars</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cover Letter Templates */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-foreground">Cover Letters</h3>
                    <span className="text-xs bg-surface-hover text-muted px-2 py-0.5 rounded-full">{coverLetterTemplates.length}</span>
                  </div>
                  <Button onClick={() => handleOpenNewTemplate("coverLetter")} variant="primary" className="text-xs py-1.5 px-3">
                    + Add
                  </Button>
                </div>
                {coverLetterTemplates.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-card-border rounded-xl">
                    <p className="text-muted text-sm">No templates yet</p>
                    <button onClick={() => handleOpenNewTemplate("coverLetter")} className="text-primary text-sm mt-1 hover:underline">Create your first</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {coverLetterTemplates.map((t) => (
                      <div key={t.id} className={`p-3 rounded-xl border transition-all ${t.id === defaultCoverLetterId ? "border-primary bg-primary/5 shadow-sm" : "border-card-border hover:border-primary/30"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{t.name}</span>
                            {t.id === defaultCoverLetterId && <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-medium">DEFAULT</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            {t.id !== defaultCoverLetterId && (
                              <button onClick={() => handleSetDefault("coverLetter", t.id)} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-yellow-500" title="Set default">⭐</button>
                            )}
                            <button onClick={() => handleOpenEditTemplate("coverLetter", t)} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-primary text-xs">Edit</button>
                            <button onClick={() => handleDeleteTemplate("coverLetter", t.id)} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-red-500 text-xs">Delete</button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted mt-1">{new Date(t.updatedAt).toLocaleDateString()} • {t.content.length.toLocaleString()} chars</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {editingTemplate && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingTemplate(null); }}
        >
          <div className="glass-card p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto fade-in shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {editingTemplate.template ? "Edit" : "New"} {editingTemplate.type === "resume" ? "Resume" : "Cover Letter"} Template
                </h2>
                <p className="text-sm text-muted mt-1">Give it a memorable name like "Software Engineer" or "Cloud Role"</p>
              </div>
              <button onClick={() => setEditingTemplate(null)} className="p-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5 block">Template Name</label>
              <input
                type="text"
                value={editTemplateName}
                onChange={(e) => setEditTemplateName(e.target.value)}
                placeholder="e.g., Software Engineer, Cloud Engineer, General..."
                className="input-field"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5 block">LaTeX Content</label>
              <textarea
                value={editTemplateContent}
                onChange={(e) => setEditTemplateContent(e.target.value)}
                placeholder="Paste your LaTeX template here..."
                className="input-field h-72 font-mono text-xs resize-none"
              />
              <p className="text-xs text-muted mt-2">{editTemplateContent.length.toLocaleString()} characters</p>
            </div>

            <div className="flex justify-end gap-3">
              <Button onClick={() => setEditingTemplate(null)} variant="secondary" className="px-5 py-2">Cancel</Button>
              <Button onClick={handleSaveTemplate} variant="primary" className="px-5 py-2" disabled={!editTemplateName.trim() || !editTemplateContent.trim()}>
                {editingTemplate.template ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowProfileEditor(false); }}
        >
          <div className="glass-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto fade-in shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {editingProfile ? "Edit Profile" : "New Profile"}
                </h2>
                <p className="text-sm text-muted mt-1">
                  {editingProfile ? "Update your profile details" : "Create a profile for different job types"}
                </p>
              </div>
              <button onClick={() => setShowProfileEditor(false)} className="p-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Profile Preview */}
            <div className="flex justify-center mb-6">
              <div className={`w-16 h-16 rounded-full bg-linear-to-br ${editingProfile?.color || getNextProfileColor()} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                {profileFormFirstName?.[0]?.toUpperCase() || "?"}{profileFormLastName?.[0]?.toUpperCase() || ""}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5 block">Profile Name</label>
                <input
                  type="text"
                  value={profileFormName}
                  onChange={(e) => setProfileFormName(e.target.value)}
                  placeholder="e.g., Software Engineer, Cloud Role..."
                  className="input-field"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5 block">First Name</label>
                  <input
                    type="text"
                    value={profileFormFirstName}
                    onChange={(e) => setProfileFormFirstName(e.target.value)}
                    placeholder="John"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5 block">Last Name</label>
                  <input
                    type="text"
                    value={profileFormLastName}
                    onChange={(e) => setProfileFormLastName(e.target.value)}
                    placeholder="Doe"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted uppercase tracking-wide">Default Resume Template</label>
                  <button
                    onClick={() => setShowNewResumeInProfile(!showNewResumeInProfile)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {showNewResumeInProfile ? "Cancel" : "+ Add New"}
                  </button>
                </div>
                {showNewResumeInProfile ? (
                  <div className="space-y-2 p-3 border border-primary/30 rounded-lg bg-primary/5">
                    <input
                      type="text"
                      value={newResumeNameInProfile}
                      onChange={(e) => setNewResumeNameInProfile(e.target.value)}
                      placeholder="Template name (e.g., Software Engineer)"
                      className="input-field text-sm"
                    />
                    <textarea
                      value={newResumeContentInProfile}
                      onChange={(e) => setNewResumeContentInProfile(e.target.value)}
                      placeholder="Paste your LaTeX resume template here..."
                      className="input-field h-32 font-mono text-xs resize-none"
                    />
                    <Button
                      onClick={handleAddResumeInProfile}
                      variant="primary"
                      className="w-full text-xs py-1.5"
                      disabled={!newResumeNameInProfile.trim() || !newResumeContentInProfile.trim()}
                    >
                      Create & Select Resume Template
                    </Button>
                  </div>
                ) : (
                  <select
                    value={profileFormResumeId || ""}
                    onChange={(e) => setProfileFormResumeId(e.target.value || null)}
                    className="input-field"
                  >
                    <option value="">None selected</option>
                    {resumeTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted uppercase tracking-wide">Default Cover Letter Template</label>
                  <button
                    onClick={() => setShowNewCoverLetterInProfile(!showNewCoverLetterInProfile)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {showNewCoverLetterInProfile ? "Cancel" : "+ Add New"}
                  </button>
                </div>
                {showNewCoverLetterInProfile ? (
                  <div className="space-y-2 p-3 border border-primary/30 rounded-lg bg-primary/5">
                    <input
                      type="text"
                      value={newCoverLetterNameInProfile}
                      onChange={(e) => setNewCoverLetterNameInProfile(e.target.value)}
                      placeholder="Template name (e.g., General Cover Letter)"
                      className="input-field text-sm"
                    />
                    <textarea
                      value={newCoverLetterContentInProfile}
                      onChange={(e) => setNewCoverLetterContentInProfile(e.target.value)}
                      placeholder="Paste your LaTeX cover letter template here..."
                      className="input-field h-32 font-mono text-xs resize-none"
                    />
                    <Button
                      onClick={handleAddCoverLetterInProfile}
                      variant="primary"
                      className="w-full text-xs py-1.5"
                      disabled={!newCoverLetterNameInProfile.trim() || !newCoverLetterContentInProfile.trim()}
                    >
                      Create & Select Cover Letter Template
                    </Button>
                  </div>
                ) : (
                  <select
                    value={profileFormCoverLetterId || ""}
                    onChange={(e) => setProfileFormCoverLetterId(e.target.value || null)}
                    className="input-field"
                  >
                    <option value="">None selected</option>
                    {coverLetterTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-between mt-6">
              {editingProfile ? (
                <Button
                  onClick={() => {
                    handleDeleteProfile(editingProfile.id);
                    setShowProfileEditor(false);
                  }}
                  variant="secondary"
                  className="px-4 py-2 text-red-500 hover:bg-red-50 hover:border-red-300"
                >
                  Delete
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <Button onClick={() => setShowProfileEditor(false)} variant="secondary" className="px-5 py-2">Cancel</Button>
                <Button 
                  onClick={handleSaveProfile} 
                  variant="primary" 
                  className="px-5 py-2" 
                  disabled={!profileFormName.trim() || !profileFormFirstName.trim() || !profileFormLastName.trim()}
                >
                  {editingProfile ? "Save Changes" : "Create Profile"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
