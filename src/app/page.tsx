"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Sidebar from "@/components/Sidebar";
import Button from "@/components/Button";
import { useDebouncedCallback, useAutoSave } from "@/lib/hooks";
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
  getMasterContext,
  saveMasterContext,
} from "@/lib/storage";

// Reusable status dot component for field indicators
const FieldStatusDot = ({ filled, required = true }: { filled: boolean; required?: boolean }) => {
  const colorClass = filled ? "bg-green-500" : required ? "bg-red-600" : "bg-yellow-500";
  return (
    <div
      className={`h-2.5 w-2.5 rounded-full ${colorClass} ${!filled && required ? "animate-pulse" : ""}`}
    />
  );
};

// Reusable square icon button component
const IconButton = ({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className="border-card-border hover:bg-surface-hover hover:border-primary text-muted hover:text-primary flex h-7 w-7 items-center justify-center rounded border transition-colors"
    title={title}
  >
    {children}
  </button>
);

// Common icons
const SaveIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const PlusIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// List of required fields for progress tracking
const REQUIRED_FIELDS = ["resumeLatex", "jobDescription", "companyName", "positionTitle"] as const;

export default function Home() {
  const router = useRouter();
  const {
    setFirstName,
    setLastName,
    resumeLatex,
    setResumeLatex,
    coverLetterLatex,
    setCoverLetterLatex,
    jobDescription,
    setJobDescription,
    personalDetails,
    setPersonalDetails,
    masterContext,
    setMasterContext,
    manualResearch,
    setManualResearch,
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
    setTailoredResume,
    setTailoredCoverLetter,
    setJobCountry,
    setJobWorkMode,
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
  const [profileFormAvatarText, setProfileFormAvatarText] = useState("");

  // Inline template creation in profile modal
  const [showNewResumeInProfile, setShowNewResumeInProfile] = useState(false);
  const [showNewCoverLetterInProfile, setShowNewCoverLetterInProfile] = useState(false);
  const [newResumeNameInProfile, setNewResumeNameInProfile] = useState("");
  const [newResumeContentInProfile, setNewResumeContentInProfile] = useState("");
  const [newCoverLetterNameInProfile, setNewCoverLetterNameInProfile] = useState("");
  const [newCoverLetterContentInProfile, setNewCoverLetterContentInProfile] = useState("");

  // Auto-save draft application data
  const draftData = {
    companyName,
    companyUrl,
    positionTitle,
    jobDescription,
    personalDetails,
  };
  useAutoSave(
    "fd_draft_application",
    draftData,
    2000, // Save after 2 seconds of inactivity
  );

  // Debounced function to clear manual research
  const debouncedClearResearch = useDebouncedCallback(() => {
    if (manualResearch) {
      setManualResearch("");
    }
  }, 500);

  // Show notification helper
  const showNotification = (message: string) => {
    setSavedNotification(message);
    setTimeout(() => setSavedNotification(null), 2000);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data from cloud storage on mount
  useEffect(() => {
    const loadData = async () => {
      // Load profiles first
      const loadedProfiles = await getProfiles();
      setProfiles(loadedProfiles);
      const activeId = await getActiveProfileId();
      setActiveProfileIdState(activeId);

      // Load templates
      const resumes = await getResumeTemplates();
      const coverLetters = await getCoverLetterTemplates();
      setResumeTemplates(resumes);
      setCoverLetterTemplates(coverLetters);
      setDefaultResumeIdState(await getDefaultResumeId());
      setDefaultCoverLetterIdState(await getDefaultCoverLetterId());

      // If we have an active profile, use its data
      const activeProfile = loadedProfiles.find((p) => p.id === activeId);
      if (activeProfile) {
        setFirstName(activeProfile.firstName);
        setLastName(activeProfile.lastName);
        // Load profile's default resume
        if (activeProfile.defaultResumeId) {
          const profileResume = resumes.find((t) => t.id === activeProfile.defaultResumeId);
          if (profileResume) {
            setResumeLatex(profileResume.content);
            setSelectedResumeTemplateId(profileResume.id);
          }
        }
        // Load profile's default cover letter
        if (activeProfile.defaultCoverLetterId) {
          const profileCoverLetter = coverLetters.find(
            (t) => t.id === activeProfile.defaultCoverLetterId,
          );
          if (profileCoverLetter) {
            setCoverLetterLatex(profileCoverLetter.content);
            setSelectedCoverLetterTemplateId(profileCoverLetter.id);
          }
        }
      } else if (loadedProfiles.length === 0) {
        // No profiles exist - check legacy personal details
        const savedDetails = await getPersonalDetails();
        if (savedDetails) {
          setFirstName(savedDetails.firstName);
          setLastName(savedDetails.lastName);
        } else {
          setShowPersonalDetailsModal(true);
        }
        // Load default templates
        if (!resumeLatex) {
          const defaultResume = await getDefaultResumeTemplate();
          if (defaultResume) {
            setResumeLatex(defaultResume.content);
            setSelectedResumeTemplateId(defaultResume.id);
          }
        }
        if (!coverLetterLatex) {
          const defaultCoverLetter = await getDefaultCoverLetterTemplate();
          if (defaultCoverLetter) {
            setCoverLetterLatex(defaultCoverLetter.content);
            setSelectedCoverLetterTemplateId(defaultCoverLetter.id);
          }
        }
      }

      // Load saved master context
      if (!masterContext) {
        if (activeProfile) {
          const profileContext = await getMasterContext(activeProfile.id);
          if (profileContext) {
            setMasterContext(profileContext);
          }
        } else {
          const savedContext = localStorage.getItem("fd_master_context");
          if (savedContext) {
            setMasterContext(savedContext);
          }
        }
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSavePersonalDetails = async () => {
    if (!tempFirstName.trim() || !tempLastName.trim()) {
      alert("Please enter both first name and last name.");
      return;
    }
    await savePersonalDetails({
      firstName: tempFirstName.trim(),
      lastName: tempLastName.trim(),
    });
    setFirstName(tempFirstName.trim());
    setLastName(tempLastName.trim());
    setShowPersonalDetailsModal(false);

    // Also create a default profile if none exist
    if (profiles.length === 0) {
      const newProfile = await addProfile(
        "Default",
        tempFirstName.trim(),
        tempLastName.trim(),
        await getDefaultResumeId(),
        await getDefaultCoverLetterId(),
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
      const profileResume = resumeTemplates.find((t) => t.id === profile.defaultResumeId);
      if (profileResume) {
        setResumeLatex(profileResume.content);
        setSelectedResumeTemplateId(profileResume.id);
      }
    }
    if (profile.defaultCoverLetterId) {
      const profileCoverLetter = coverLetterTemplates.find(
        (t) => t.id === profile.defaultCoverLetterId,
      );
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
    setProfileFormAvatarText("");
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
    setProfileFormAvatarText(profile.avatarText || "");
    // Reset inline template creation
    setShowNewResumeInProfile(false);
    setShowNewCoverLetterInProfile(false);
    setNewResumeNameInProfile("");
    setNewResumeContentInProfile("");
    setNewCoverLetterNameInProfile("");
    setNewCoverLetterContentInProfile("");
    setShowProfileEditor(true);
  };

  const handleAddResumeInProfile = async () => {
    if (!newResumeNameInProfile.trim() || !newResumeContentInProfile.trim()) return;
    const newTemplate = await addResumeTemplate(
      newResumeNameInProfile.trim(),
      newResumeContentInProfile.trim(),
    );
    setResumeTemplates(await getResumeTemplates());
    setProfileFormResumeId(newTemplate.id);
    setShowNewResumeInProfile(false);
    setNewResumeNameInProfile("");
    setNewResumeContentInProfile("");
    showNotification("Resume template created!");
  };

  const handleAddCoverLetterInProfile = async () => {
    if (!newCoverLetterNameInProfile.trim() || !newCoverLetterContentInProfile.trim()) return;
    const newTemplate = await addCoverLetterTemplate(
      newCoverLetterNameInProfile.trim(),
      newCoverLetterContentInProfile.trim(),
    );
    setCoverLetterTemplates(await getCoverLetterTemplates());
    setProfileFormCoverLetterId(newTemplate.id);
    setShowNewCoverLetterInProfile(false);
    setNewCoverLetterNameInProfile("");
    setNewCoverLetterContentInProfile("");
    showNotification("Cover letter template created!");
  };

  const handleSaveProfile = async () => {
    if (!profileFormName.trim() || !profileFormFirstName.trim() || !profileFormLastName.trim()) {
      alert("Please fill in profile name, first name, and last name.");
      return;
    }

    if (editingProfile) {
      // Update existing profile
      await updateProfile(editingProfile.id, {
        name: profileFormName.trim(),
        firstName: profileFormFirstName.trim(),
        lastName: profileFormLastName.trim(),
        defaultResumeId: profileFormResumeId,
        defaultCoverLetterId: profileFormCoverLetterId,
        avatarText: profileFormAvatarText.trim() || undefined,
      });
      // Update local state
      if (activeProfileId === editingProfile.id) {
        setFirstName(profileFormFirstName.trim());
        setLastName(profileFormLastName.trim());
      }
    } else {
      // Create new profile
      const newProfile = await addProfile(
        profileFormName.trim(),
        profileFormFirstName.trim(),
        profileFormLastName.trim(),
        profileFormResumeId,
        profileFormCoverLetterId,
        profileFormAvatarText.trim() || undefined,
      );
      // Select the new profile
      handleSelectProfile(newProfile);
    }
    setProfiles(await getProfiles());
    setShowProfileEditor(false);
    showNotification(editingProfile ? "Profile updated!" : "Profile created!");
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    await deleteProfile(id);
    const updatedProfiles = await getProfiles();
    setProfiles(updatedProfiles);
    // If deleted profile was active, switch to first available
    if (activeProfileId === id) {
      const firstProfile = updatedProfiles[0];
      if (updatedProfiles.length > 0 && firstProfile) {
        handleSelectProfile(firstProfile);
      } else {
        setActiveProfileIdState(null);
      }
    }
    showNotification("Profile deleted!");
  };

  // Generate cache key for research
  const handleGenerate = async () => {
    if (!companyName || !positionTitle || !jobDescription) {
      setError("Please fill in company name, position title, and job description.");
      return;
    }
    setError(null);

    if (resumeLatex && jobDescription) {
      await triggerGenerate();
    }
  };

  const triggerGenerate = async () => {
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
          masterContext,
          manualResearch: manualResearch || undefined,
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

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    if (!editTemplateName.trim() || !editTemplateContent.trim()) {
      alert("Please provide both a name and content for the template.");
      return;
    }
    const { type, template } = editingTemplate;

    if (template) {
      if (type === "resume") {
        await updateResumeTemplate(template.id, {
          name: editTemplateName.trim(),
          content: editTemplateContent,
        });
        setResumeTemplates(await getResumeTemplates());
        if (selectedResumeTemplateId === template.id) setResumeLatex(editTemplateContent);
      } else {
        await updateCoverLetterTemplate(template.id, {
          name: editTemplateName.trim(),
          content: editTemplateContent,
        });
        setCoverLetterTemplates(await getCoverLetterTemplates());
        if (selectedCoverLetterTemplateId === template.id) setCoverLetterLatex(editTemplateContent);
      }
    } else {
      if (type === "resume") {
        const newTemplate = await addResumeTemplate(editTemplateName.trim(), editTemplateContent);
        setResumeTemplates(await getResumeTemplates());
        setDefaultResumeIdState(await getDefaultResumeId());
        setResumeLatex(editTemplateContent);
        setSelectedResumeTemplateId(newTemplate.id);
      } else {
        const newTemplate = await addCoverLetterTemplate(
          editTemplateName.trim(),
          editTemplateContent,
        );
        setCoverLetterTemplates(await getCoverLetterTemplates());
        setDefaultCoverLetterIdState(await getDefaultCoverLetterId());
        setCoverLetterLatex(editTemplateContent);
        setSelectedCoverLetterTemplateId(newTemplate.id);
      }
    }
    setEditingTemplate(null);
    showNotification("Template saved!");
  };

  const handleDeleteTemplate = async (type: "resume" | "coverLetter", id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    if (type === "resume") {
      await deleteResumeTemplate(id);
      setResumeTemplates(await getResumeTemplates());
      setDefaultResumeIdState(await getDefaultResumeId());
      if (selectedResumeTemplateId === id) {
        const defaultTemplate = await getDefaultResumeTemplate();
        if (defaultTemplate) {
          setResumeLatex(defaultTemplate.content);
          setSelectedResumeTemplateId(defaultTemplate.id);
        } else {
          setResumeLatex("");
          setSelectedResumeTemplateId("");
        }
      }
    } else {
      await deleteCoverLetterTemplate(id);
      setCoverLetterTemplates(await getCoverLetterTemplates());
      setDefaultCoverLetterIdState(await getDefaultCoverLetterId());
      if (selectedCoverLetterTemplateId === id) {
        const defaultTemplate = await getDefaultCoverLetterTemplate();
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

  const handleSetDefault = async (type: "resume" | "coverLetter", id: string) => {
    if (type === "resume") {
      await setDefaultResumeId(id);
      setDefaultResumeIdState(id);
    } else {
      await setDefaultCoverLetterId(id);
      setDefaultCoverLetterIdState(id);
    }
    showNotification("Default template updated!");
  };

  const handleSaveCurrentResumeToTemplate = async () => {
    if (selectedResumeTemplateId && resumeLatex) {
      await updateResumeTemplate(selectedResumeTemplateId, {
        content: resumeLatex,
      });
      setResumeTemplates(await getResumeTemplates());
      showNotification("Resume template updated!");
    }
  };

  const handleSaveCurrentCoverLetterToTemplate = async () => {
    if (selectedCoverLetterTemplateId && coverLetterLatex) {
      await updateCoverLetterTemplate(selectedCoverLetterTemplateId, {
        content: coverLetterLatex,
      });
      setCoverLetterTemplates(await getCoverLetterTemplates());
      showNotification("Cover letter template updated!");
    }
  };

  // Progress calculation using the same required fields
  const fieldValues = {
    resumeLatex,
    jobDescription,
    companyName,
    positionTitle,
  };
  const getProgress = () => {
    const completed = REQUIRED_FIELDS.filter((field) => !!fieldValues[field]).length;
    return { completed, total: REQUIRED_FIELDS.length };
  };

  const progress = getProgress();
  const isValid = progress.completed === progress.total;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar title="Step 1: Input">
        {/* Step Navigation */}
        <div className="border-b border-gray-100 p-3">
          <div className="flex items-center gap-1">
            <div className="bg-primary/10 border-primary text-primary flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium">
              <span className="bg-primary flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white">
                1
              </span>
              Input
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <button
              onClick={() => router.push("/tailored")}
              className="hover:bg-surface-hover text-muted hover:text-foreground flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors"
            >
              <span className="bg-card-border text-muted flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                2
              </span>
              Review
            </button>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <button
              onClick={() => router.push("/questions")}
              className="hover:bg-surface-hover text-muted hover:text-foreground flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors"
            >
              <span className="bg-card-border text-muted flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                3
              </span>
              Q&A
            </button>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="space-y-3 border-b border-gray-100 p-4">
          <div className="flex gap-2">
            <Button
              onClick={() => setShowTemplateManager(true)}
              variant="secondary"
              className="flex-1 py-2 text-xs"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Templates
            </Button>
            <Button
              onClick={() => window.open("/jobs", "_blank")}
              variant="secondary"
              className="flex-1 py-2 text-xs"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 7h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM10 4h4v3h-4V4z" />
              </svg>
              Companies
            </Button>
          </div>
          <button
            onClick={() => router.push("/batch")}
            className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-black to-gray-800 px-3 py-3 text-xs font-medium text-white shadow-md transition-all hover:from-gray-800 hover:to-black hover:shadow-lg"
          >
            {/* NEW badge */}
            <span className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] leading-none font-bold text-white">
              NEW
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Batch Mode
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Profiles */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Profiles</label>
              <button
                onClick={handleOpenNewProfile}
                className="border-card-border hover:border-primary text-muted hover:text-primary flex h-6 w-6 items-center justify-center rounded-full border border-dashed transition-colors"
                title="Add profile"
              >
                <PlusIcon size={10} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="group relative flex flex-col items-center">
                  <div
                    className={`rounded-full p-0.5 transition-all duration-300 ease-out ${
                      activeProfileId === profile.id
                        ? "from-primary via-primary/80 to-primary/60 shadow-primary/30 scale-110 bg-linear-to-br shadow-md"
                        : "bg-transparent hover:scale-105"
                    }`}
                  >
                    <button
                      onClick={() => handleSelectProfile(profile)}
                      className={`h-10 w-10 rounded-full bg-linear-to-br ${profile.color} flex items-center justify-center text-sm font-bold text-white shadow-lg transition-all duration-300 ${
                        activeProfileId === profile.id
                          ? "ring-2 ring-white"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      title={profile.name}
                    >
                      {profile.avatarText ||
                        `${profile.firstName?.[0]?.toUpperCase() || "?"}${profile.lastName?.[0]?.toUpperCase() || ""}`}
                    </button>
                  </div>
                  {/* Edit button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditProfile(profile);
                    }}
                    className="border-card-border hover:bg-surface-hover absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    title="Edit profile"
                  >
                    <EditIcon size={8} />
                  </button>
                  {/* Profile name below */}
                  <span
                    className={`mt-1 max-w-12.5 truncate text-center text-[10px] transition-colors duration-300 ${
                      activeProfileId === profile.id ? "text-primary font-medium" : "text-muted"
                    }`}
                  >
                    {profile.name}
                  </span>
                </div>
              ))}
              {profiles.length === 0 && (
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleOpenNewProfile}
                    className="border-card-border text-muted hover:border-primary hover:text-primary flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed transition-colors"
                    title="Add your first profile"
                  >
                    <PlusIcon size={14} />
                  </button>
                  <span className="text-muted mt-1 text-[10px]">Add</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Progress</label>
            <div className="bg-surface-hover/50 flex items-center gap-2 rounded-lg p-3">
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full transition-colors ${
                      i < progress.completed ? "bg-primary" : "bg-card-border"
                    }`}
                  />
                ))}
              </div>
              <span className="text-muted text-sm">{progress.completed}/4 required fields</span>
            </div>
          </div>
        </div>
      </Sidebar>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Floating Notification */}
        {savedNotification && (
          <div className="fade-in fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-white shadow-lg">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {savedNotification}
          </div>
        )}

        {/* Form Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-3 lg:space-y-5">
            {/* Resume and Cover Letter - Side by Side */}
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
              {/* Resume LaTeX */}
              <div className="glass-card fade-in group flex flex-col p-3 lg:p-5">
                <div className="mb-2 flex items-center justify-between lg:mb-3">
                  <div className="flex items-center gap-2">
                    <FieldStatusDot filled={!!resumeLatex} required />
                    <label className="section-label mb-0 text-sm lg:text-base">Resume</label>
                  </div>
                  <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    {resumeTemplates.length > 0 && (
                      <select
                        value={selectedResumeTemplateId}
                        onChange={(e) => handleSelectResumeTemplate(e.target.value)}
                        className="border-card-border bg-background text-foreground focus:border-primary cursor-pointer rounded-lg border px-2 py-1 text-xs focus:outline-none"
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
                        <IconButton
                          onClick={handleSaveCurrentResumeToTemplate}
                          title="Save to template"
                        >
                          <SaveIcon size={12} />
                        </IconButton>
                        <IconButton
                          onClick={() => {
                            const template = resumeTemplates.find(
                              (t) => t.id === selectedResumeTemplateId,
                            );
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
                    <IconButton
                      onClick={() => handleOpenNewTemplate("resume")}
                      title="New template"
                    >
                      <PlusIcon />
                    </IconButton>
                  </div>
                </div>
                <textarea
                  className="input-field h-48 resize-none overflow-y-auto font-mono text-xs lg:h-64"
                  placeholder="Paste your resume LaTeX code here..."
                  value={resumeLatex}
                  onChange={(e) => setResumeLatex(e.target.value)}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted text-xs">
                    {resumeLatex.length.toLocaleString()} chars
                  </span>
                  {resumeLatex && <span className="text-xs text-green-500">✓ Ready</span>}
                </div>
              </div>

              {/* Cover Letter LaTeX */}
              <div className="glass-card fade-in group flex flex-col p-3 lg:p-5">
                <div className="mb-2 flex items-center justify-between lg:mb-3">
                  <div className="flex items-center gap-2">
                    <FieldStatusDot filled={!!coverLetterLatex} required={false} />
                    <label className="section-label mb-0 text-sm lg:text-base">Cover Letter</label>
                    <span className="text-muted text-xs">(optional)</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    {coverLetterTemplates.length > 0 && (
                      <select
                        value={selectedCoverLetterTemplateId}
                        onChange={(e) => handleSelectCoverLetterTemplate(e.target.value)}
                        className="border-card-border bg-background text-foreground focus:border-primary cursor-pointer rounded-lg border px-2 py-1 text-xs focus:outline-none"
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
                        <IconButton
                          onClick={handleSaveCurrentCoverLetterToTemplate}
                          title="Save to template"
                        >
                          <SaveIcon size={12} />
                        </IconButton>
                        <IconButton
                          onClick={() => {
                            const template = coverLetterTemplates.find(
                              (t) => t.id === selectedCoverLetterTemplateId,
                            );
                            if (template) handleOpenEditTemplate("coverLetter", template);
                          }}
                          title="Edit template"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() =>
                            handleDeleteTemplate("coverLetter", selectedCoverLetterTemplateId)
                          }
                          title="Delete template"
                        >
                          <TrashIcon />
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      onClick={() => handleOpenNewTemplate("coverLetter")}
                      title="New template"
                    >
                      <PlusIcon />
                    </IconButton>
                  </div>
                </div>
                <textarea
                  className="input-field h-48 resize-none overflow-y-auto font-mono text-xs lg:h-64"
                  placeholder="Paste your cover letter LaTeX code here..."
                  value={coverLetterLatex}
                  onChange={(e) => setCoverLetterLatex(e.target.value)}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted text-xs">
                    {coverLetterLatex.length.toLocaleString()} chars
                  </span>
                  {coverLetterLatex && <span className="text-xs text-green-500">✓ Ready</span>}
                </div>
              </div>
            </div>

            {/* Company Details */}
            <div className="glass-card fade-in p-3 lg:p-5">
              <div className="mb-3 flex items-center gap-2 lg:mb-4">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <label className="section-label mb-0 text-sm lg:text-base">Company Details</label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <FieldStatusDot filled={!!companyName} required />
                    <label className="text-muted text-xs font-medium tracking-wide uppercase">
                      Company Name
                    </label>
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
                  <div className="mb-1.5 flex items-center gap-2">
                    <FieldStatusDot filled={!!companyUrl} required={false} />
                    <label className="text-muted text-xs font-medium tracking-wide uppercase">
                      Company URL <span className="font-normal normal-case">(optional)</span>
                    </label>
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
                  <div className="mb-1.5 flex items-center gap-2">
                    <FieldStatusDot filled={!!positionTitle} required />
                    <label className="text-muted text-xs font-medium tracking-wide uppercase">
                      Position Title
                    </label>
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
            <div className="glass-card fade-in p-3 lg:p-5">
              <div className="mb-2 flex items-center gap-2 lg:mb-3">
                <FieldStatusDot filled={!!jobDescription} required />
                <label className="section-label mb-0 text-sm lg:text-base">Job Description</label>
                {jobDescription && (
                  <span className="text-muted ml-auto text-xs">
                    {jobDescription.split(/\s+/).length} words
                  </span>
                )}
              </div>
              <textarea
                className="input-field h-76 resize-none overflow-y-auto lg:h-102"
                placeholder="Paste the full job description including title, responsibilities, and requirements..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            {/* Custom Instructions and Company Info - Side by Side */}
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
              <div className="glass-card fade-in p-3 lg:p-5">
                <div className="mb-2 flex items-center gap-2 lg:mb-3">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <label className="section-label mb-0 text-sm lg:text-base">
                    Custom Instructions
                  </label>
                  <span className="text-muted text-xs">(optional)</span>
                </div>
                <textarea
                  className="input-field h-24 resize-none overflow-y-auto text-sm lg:h-28"
                  placeholder="Emphasize leadership, focus on backend, highlight specific projects..."
                  value={personalDetails}
                  onChange={(e) => setPersonalDetails(e.target.value)}
                />
              </div>

              <div className="glass-card fade-in p-3 lg:p-5">
                <div className="mb-2 flex items-center gap-2 lg:mb-3">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <label className="section-label mb-0 text-sm lg:text-base">Company Info</label>
                  <span className="text-muted text-xs">(auto-filled by research)</span>
                </div>
                <textarea
                  className="input-field h-24 resize-none overflow-y-auto text-sm lg:h-28"
                  placeholder="Will be auto-filled when you click Generate..."
                  value={manualResearch}
                  onChange={(e) => setManualResearch(e.target.value)}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="fade-in rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
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
        <div className="border-card-border bg-surface-hover/50 border-t p-3 lg:p-4">
          <div className="flex flex-col items-center gap-2 lg:gap-3">
            <Button
              onClick={handleGenerate}
              disabled={!isValid || isGeneratingTailored}
              variant="primary"
              className="px-6 py-2 text-sm shadow-lg transition-shadow hover:shadow-xl lg:px-10 lg:py-3 lg:text-base"
            >
              {isGeneratingTailored ? (
                <>
                  <span className="spinner" />
                  Generating tailored resume...
                </>
              ) : isGeneratingTailored ? (
                <>
                  <span className="spinner" />
                  Generating documents...
                </>
              ) : (
                <>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Generate Tailored Documents
                </>
              )}
            </Button>
            {!isValid && (
              <p className="text-muted flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1">
                  {!resumeLatex && (
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                  )}
                  {!jobDescription && (
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                  )}
                  {!companyName && (
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                  )}
                  {!positionTitle && (
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                  )}
                </span>
                {4 - progress.completed} required field
                {4 - progress.completed !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Personal Details Modal */}
      {showPersonalDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-card fade-in w-full max-w-md p-8 shadow-2xl">
            <div className="mb-6 text-center">
              <div className="from-primary to-primary/60 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br text-white">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h2 className="text-foreground text-2xl font-bold">Welcome!</h2>
              <p className="text-muted mt-2 text-sm">
                Enter your name to personalize your documents
              </p>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
                  First Name
                </label>
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
                <label className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
                  Last Name
                </label>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTemplateManager(false);
          }}
        >
          <div className="glass-card fade-in flex max-h-[90vh] w-[90vw] max-w-6xl flex-col overflow-hidden p-6 shadow-2xl">
            <div className="border-card-border mb-4 flex shrink-0 items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-foreground text-xl font-bold">Template Manager</h2>
                <p className="text-muted mt-1 text-sm">
                  Organize your resume & cover letter templates, and your Master Context
                </p>
              </div>
              <button
                onClick={() => setShowTemplateManager(false)}
                className="hover:bg-surface-hover text-muted hover:text-foreground rounded-lg p-2 transition-colors"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Main Content - scrollable */}
            <div className="flex-1 space-y-6 overflow-y-auto pr-1">
              {/* Master Context Section - Full Width */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-indigo-600"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-800">Master Context</h3>
                      <p className="text-[10px] text-indigo-600">
                        Your complete professional background — skills, experience, education,
                        projects, achievements, personality, and career goals. This is the
                        authoritative source the AI uses to tailor your documents.
                      </p>
                    </div>
                  </div>
                  <span className="text-muted text-[10px]">
                    {masterContext.length.toLocaleString()} chars
                  </span>
                </div>
                <textarea
                  value={masterContext}
                  onChange={(e) => setMasterContext(e.target.value)}
                  placeholder={`Paste your full professional background here. Include:\n\n• Work Experience — company names, roles, dates, key achievements\n• Skills — technical (languages, frameworks, tools), soft skills\n• Education — degrees, institutions, certifications\n• Projects — names, descriptions, technologies used, impact\n• Achievements — awards, publications, patents, speaking engagements\n• Career Goals — target roles, industries, locations, work preferences\n• Personal Voice — writing style, personality traits, values\n\nThis will be used as the authoritative source for all AI generations.`}
                  className="input-field h-48 w-full resize-y font-mono text-xs"
                  spellCheck={false}
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-muted text-[10px]">
                    The AI uses ONLY this context to tailor your documents. Keep it comprehensive
                    and truthful.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        if (activeProfileId) {
                          await saveMasterContext(activeProfileId, masterContext);
                        } else {
                          localStorage.setItem("fd_master_context", masterContext);
                        }
                        showNotification("Master Context saved!");
                      } catch {
                        showNotification("Failed to save — content too large?");
                      }
                    }}
                    className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    Save Context
                  </button>
                </div>
              </div>

              {/* Templates Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Resume Templates */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-blue-500"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <h3 className="text-foreground font-semibold">Resumes</h3>
                      <span className="bg-surface-hover text-muted rounded-full px-2 py-0.5 text-xs">
                        {resumeTemplates.length}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleOpenNewTemplate("resume")}
                      variant="primary"
                      className="px-3 py-1.5 text-xs"
                    >
                      + Add
                    </Button>
                  </div>
                  {resumeTemplates.length === 0 ? (
                    <div className="border-card-border rounded-xl border-2 border-dashed py-8 text-center">
                      <p className="text-muted text-sm">No templates yet</p>
                      <button
                        onClick={() => handleOpenNewTemplate("resume")}
                        className="text-primary mt-1 text-sm hover:underline"
                      >
                        Create your first
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {resumeTemplates.map((t) => (
                        <div
                          key={t.id}
                          className={`rounded-xl border p-3 transition-all ${t.id === defaultResumeId ? "border-primary bg-primary/5 shadow-sm" : "border-card-border hover:border-primary/30"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{t.name}</span>
                              {t.id === defaultResumeId && (
                                <span className="bg-primary rounded px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {t.id !== defaultResumeId && (
                                <button
                                  onClick={() => handleSetDefault("resume", t.id)}
                                  className="hover:bg-surface-hover text-muted rounded p-1 hover:text-yellow-500"
                                  title="Set default"
                                >
                                  ⭐
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditTemplate("resume", t)}
                                className="hover:bg-surface-hover text-muted hover:text-primary rounded p-1 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate("resume", t.id)}
                                className="hover:bg-surface-hover text-muted rounded p-1 text-xs hover:text-red-500"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p className="text-muted mt-1 text-[10px]">
                            {new Date(t.updatedAt).toLocaleDateString()} •{" "}
                            {t.content.length.toLocaleString()} chars
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cover Letter Templates */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-purple-500"
                        >
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      </div>
                      <h3 className="text-foreground font-semibold">Cover Letters</h3>
                      <span className="bg-surface-hover text-muted rounded-full px-2 py-0.5 text-xs">
                        {coverLetterTemplates.length}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleOpenNewTemplate("coverLetter")}
                      variant="primary"
                      className="px-3 py-1.5 text-xs"
                    >
                      + Add
                    </Button>
                  </div>
                  {coverLetterTemplates.length === 0 ? (
                    <div className="border-card-border rounded-xl border-2 border-dashed py-8 text-center">
                      <p className="text-muted text-sm">No templates yet</p>
                      <button
                        onClick={() => handleOpenNewTemplate("coverLetter")}
                        className="text-primary mt-1 text-sm hover:underline"
                      >
                        Create your first
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {coverLetterTemplates.map((t) => (
                        <div
                          key={t.id}
                          className={`rounded-xl border p-3 transition-all ${t.id === defaultCoverLetterId ? "border-primary bg-primary/5 shadow-sm" : "border-card-border hover:border-primary/30"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{t.name}</span>
                              {t.id === defaultCoverLetterId && (
                                <span className="bg-primary rounded px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {t.id !== defaultCoverLetterId && (
                                <button
                                  onClick={() => handleSetDefault("coverLetter", t.id)}
                                  className="hover:bg-surface-hover text-muted rounded p-1 hover:text-yellow-500"
                                  title="Set default"
                                >
                                  ⭐
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditTemplate("coverLetter", t)}
                                className="hover:bg-surface-hover text-muted hover:text-primary rounded p-1 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate("coverLetter", t.id)}
                                className="hover:bg-surface-hover text-muted rounded p-1 text-xs hover:text-red-500"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p className="text-muted mt-1 text-[10px]">
                            {new Date(t.updatedAt).toLocaleDateString()} •{" "}
                            {t.content.length.toLocaleString()} chars
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {editingTemplate && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingTemplate(null);
          }}
        >
          <div className="glass-card fade-in max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-foreground text-xl font-bold">
                  {editingTemplate.template ? "Edit" : "New"}{" "}
                  {editingTemplate.type === "resume" ? "Resume" : "Cover Letter"} Template
                </h2>
                <p className="text-muted mt-1 text-sm">
                  Give it a memorable name like &quot;Software Engineer&quot; or &quot;Cloud
                  Role&quot;
                </p>
              </div>
              <button
                onClick={() => setEditingTemplate(null)}
                className="hover:bg-surface-hover text-muted hover:text-foreground rounded-lg p-2 transition-colors"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
                Template Name
              </label>
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
              <label className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
                LaTeX Content
              </label>
              <textarea
                value={editTemplateContent}
                onChange={(e) => setEditTemplateContent(e.target.value)}
                placeholder="Paste your LaTeX template here..."
                className="input-field h-72 resize-none font-mono text-xs"
              />
              <p className="text-muted mt-2 text-xs">
                {editTemplateContent.length.toLocaleString()} characters
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setEditingTemplate(null)}
                variant="secondary"
                className="px-5 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                variant="primary"
                className="px-5 py-2"
                disabled={!editTemplateName.trim() || !editTemplateContent.trim()}
              >
                {editingTemplate.template ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProfileEditor(false);
          }}
        >
          <div className="glass-card fade-in max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-foreground text-xl font-bold">
                  {editingProfile ? "Edit Profile" : "New Profile"}
                </h2>
                <p className="text-muted mt-1 text-sm">
                  {editingProfile
                    ? "Update your profile details"
                    : "Create a profile for different job types"}
                </p>
              </div>
              <button
                onClick={() => setShowProfileEditor(false)}
                className="hover:bg-surface-hover text-muted hover:text-foreground rounded-lg p-2 transition-colors"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Profile Preview */}
            <div className="mb-6 flex justify-center">
              <div
                className={`h-16 w-16 rounded-full bg-linear-to-br ${editingProfile?.color || getNextProfileColor()} flex items-center justify-center text-xl font-bold text-white shadow-lg`}
              >
                {profileFormAvatarText ||
                  `${profileFormFirstName?.[0]?.toUpperCase() || "?"}${profileFormLastName?.[0]?.toUpperCase() || ""}`}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
                  Profile Name
                </label>
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
                  <label className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileFormFirstName}
                    onChange={(e) => setProfileFormFirstName(e.target.value)}
                    placeholder="John"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
                    Last Name
                  </label>
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
                <label className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
                  Avatar Text <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={profileFormAvatarText}
                  onChange={(e) => setProfileFormAvatarText(e.target.value)}
                  placeholder="e.g., JD, SE, Dev... (defaults to initials)"
                  className="input-field"
                  maxLength={4}
                />
                <p className="text-muted mt-1 text-[10px]">
                  Custom text shown on profile circle (max 4 chars)
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-muted text-xs font-medium tracking-wide uppercase">
                    Default Resume Template
                  </label>
                  <button
                    onClick={() => setShowNewResumeInProfile(!showNewResumeInProfile)}
                    className="text-primary flex items-center gap-1 text-xs hover:underline"
                  >
                    {showNewResumeInProfile ? "Cancel" : "+ Add New"}
                  </button>
                </div>
                {showNewResumeInProfile ? (
                  <div className="border-primary/30 bg-primary/5 space-y-2 rounded-lg border p-3">
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
                      className="input-field h-32 resize-none font-mono text-xs"
                    />
                    <Button
                      onClick={handleAddResumeInProfile}
                      variant="primary"
                      className="w-full py-1.5 text-xs"
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
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-muted text-xs font-medium tracking-wide uppercase">
                    Default Cover Letter Template
                  </label>
                  <button
                    onClick={() => setShowNewCoverLetterInProfile(!showNewCoverLetterInProfile)}
                    className="text-primary flex items-center gap-1 text-xs hover:underline"
                  >
                    {showNewCoverLetterInProfile ? "Cancel" : "+ Add New"}
                  </button>
                </div>
                {showNewCoverLetterInProfile ? (
                  <div className="border-primary/30 bg-primary/5 space-y-2 rounded-lg border p-3">
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
                      className="input-field h-32 resize-none font-mono text-xs"
                    />
                    <Button
                      onClick={handleAddCoverLetterInProfile}
                      variant="primary"
                      className="w-full py-1.5 text-xs"
                      disabled={
                        !newCoverLetterNameInProfile.trim() ||
                        !newCoverLetterContentInProfile.trim()
                      }
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
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              {editingProfile ? (
                <Button
                  onClick={() => {
                    handleDeleteProfile(editingProfile.id);
                    setShowProfileEditor(false);
                  }}
                  variant="secondary"
                  className="px-4 py-2 text-red-500 hover:border-red-300 hover:bg-red-50"
                >
                  Delete
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowProfileEditor(false)}
                  variant="secondary"
                  className="px-5 py-2"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  variant="primary"
                  className="px-5 py-2"
                  disabled={
                    !profileFormName.trim() ||
                    !profileFormFirstName.trim() ||
                    !profileFormLastName.trim()
                  }
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
