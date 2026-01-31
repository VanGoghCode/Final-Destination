"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Navbar from "@/components/Navbar";
import Button from "@/components/Button";
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
    firstName,
    setFirstName,
    lastName,
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
    tailoredResume,
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

  // Show notification helper
  const showNotification = (message: string) => {
    setSavedNotification(message);
    setTimeout(() => setSavedNotification(null), 2000);
  };

  // Load data from localStorage on mount
  useEffect(() => {
    const savedDetails = getPersonalDetails();
    if (savedDetails) {
      setFirstName(savedDetails.firstName);
      setLastName(savedDetails.lastName);
    } else {
      setShowPersonalDetailsModal(true);
    }

    const resumes = getResumeTemplates();
    const coverLetters = getCoverLetterTemplates();
    setResumeTemplates(resumes);
    setCoverLetterTemplates(coverLetters);
    setDefaultResumeIdState(getDefaultResumeId());
    setDefaultCoverLetterIdState(getDefaultCoverLetterId());

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
  };

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

    setIsResearching(true);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, companyUrl, positionTitle, jobDescription }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to research company");
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

  const handleUpdatePersonalDetails = () => {
    savePersonalDetails({ firstName, lastName });
    showNotification("Name saved!");
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

  // Get selected template name
  const selectedResumeName = resumeTemplates.find((t) => t.id === selectedResumeTemplateId)?.name;
  const selectedCoverLetterName = coverLetterTemplates.find((t) => t.id === selectedCoverLetterTemplateId)?.name;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <Navbar currentStep={1} />

      <div className="max-w-6xl mx-auto">
        {/* Floating Notification */}
        {savedNotification && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 fade-in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {savedNotification}
          </div>
        )}

        {/* Header Section */}
        <div className="glass-card p-4 sm:p-5 mb-6 fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-linear-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {firstName?.[0]?.toUpperCase() || "?"}{lastName?.[0]?.toUpperCase() || ""}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First"
                    className="bg-transparent border-b border-transparent hover:border-card-border focus:border-primary outline-none text-foreground font-medium w-24 transition-colors"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                    className="bg-transparent border-b border-transparent hover:border-card-border focus:border-primary outline-none text-foreground font-medium w-24 transition-colors"
                  />
                  <IconButton onClick={handleUpdatePersonalDetails} title="Save name">
                    <SaveIcon />
                  </IconButton>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {resumeTemplates.length} resume{resumeTemplates.length !== 1 ? "s" : ""} • {coverLetterTemplates.length} cover letter{coverLetterTemplates.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Progress & Actions */}
            <div className="flex items-center gap-4">
              {/* Progress Indicator */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i < progress.completed ? "bg-primary" : "bg-card-border"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted">{progress.completed}/4</span>
              </div>

              {tailoredResume && (
                <Button onClick={() => router.push("/tailored")} variant="ghost" className="text-xs py-1.5 px-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View Last
                </Button>
              )}

              <Button onClick={() => setShowTemplateManager(true)} variant="secondary" className="text-xs py-1.5 px-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Templates
              </Button>
            </div>
          </div>
        </div>

        {/* Main Form Grid */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Resume LaTeX */}
          <div className="glass-card p-5 fade-in group" style={{ animationDelay: "0.05s" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FieldStatusDot filled={!!resumeLatex} required />
                <label className="section-label mb-0">Resume</label>
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
              className="input-field h-48 font-mono text-xs resize-none"
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
          <div className="glass-card p-5 fade-in group" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FieldStatusDot filled={!!coverLetterLatex} required={false} />
                <label className="section-label mb-0">Cover Letter</label>
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
              className="input-field h-48 font-mono text-xs resize-none"
              placeholder="Paste your cover letter LaTeX code here..."
              value={coverLetterLatex}
              onChange={(e) => setCoverLetterLatex(e.target.value)}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted">{coverLetterLatex.length.toLocaleString()} chars</span>
              {coverLetterLatex && <span className="text-xs text-green-500">✓ Ready</span>}
            </div>
          </div>

          {/* Job Description - Full Width */}
          <div className="glass-card p-5 lg:col-span-2 fade-in" style={{ animationDelay: "0.15s" }}>
            <div className="flex items-center gap-2 mb-3">
              <FieldStatusDot filled={!!jobDescription} required />
              <label className="section-label mb-0">Job Description</label>
              {jobDescription && <span className="text-xs text-muted ml-auto">{jobDescription.split(/\s+/).length} words</span>}
            </div>
            <textarea
              className="input-field h-36 resize-none"
              placeholder="Paste the full job description including title, responsibilities, and requirements..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          {/* Company Details Row */}
          <div className="glass-card p-5 lg:col-span-2 fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <label className="section-label mb-0">Company Details</label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  onChange={(e) => setCompanyName(e.target.value)}
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
                  onChange={(e) => setCompanyUrl(e.target.value)}
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
                  onChange={(e) => setPositionTitle(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Additional Fields Row */}
          <div className="glass-card p-5 fade-in" style={{ animationDelay: "0.25s" }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <label className="section-label mb-0">Custom Instructions</label>
              <span className="text-xs text-muted">(optional)</span>
            </div>
            <textarea
              className="input-field h-28 resize-none text-sm"
              placeholder="Emphasize leadership, focus on backend, highlight specific projects..."
              value={personalDetails}
              onChange={(e) => setPersonalDetails(e.target.value)}
            />
          </div>

          <div className="glass-card p-5 fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <label className="section-label mb-0">Company Info</label>
              <span className="text-xs text-muted">(auto-filled by research)</span>
            </div>
            <textarea
              className="input-field h-28 resize-none text-sm"
              placeholder="Will be auto-filled when you click Generate..."
              value={companyInfo}
              onChange={(e) => setCompanyInfo(e.target.value)}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-5 p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 fade-in">
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

        {/* Action Section */}
        <div className="mt-8 flex flex-col items-center gap-4 fade-in" style={{ animationDelay: "0.35s" }}>
          <Button
            onClick={handleResearch}
            disabled={!isValid || isResearching || isGeneratingTailored}
            variant="primary"
            className="text-base px-10 py-4 shadow-lg hover:shadow-xl transition-shadow"
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
    </main>
  );
}
