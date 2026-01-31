"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AppState {
  // Personal details
  firstName: string;
  lastName: string;

  // Step 1 inputs
  resumeLatex: string;
  coverLetterLatex: string;
  jobDescription: string;
  personalDetails: string;
  companyInfo: string;
  companyName: string;
  companyUrl: string;
  positionTitle: string;

  // Selected template IDs
  selectedResumeTemplateId: string;
  selectedCoverLetterTemplateId: string;

  // Company Research
  companyResearch: string;
  isResearching: boolean;

  // Step 2 outputs
  tailoredResume: string;
  tailoredCoverLetter: string;

  // Job location info (extracted during tailoring)
  jobCountry: string;
  jobWorkMode: "" | "Remote" | "Hybrid" | "On-site";

  // Step 3
  applicationQuestions: string;
  generatedAnswers: string;

  // Loading states
  isGeneratingTailored: boolean;
  isGeneratingAnswers: boolean;
}

interface AppContextType extends AppState {
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setResumeLatex: (value: string) => void;
  setCoverLetterLatex: (value: string) => void;
  setJobDescription: (value: string) => void;
  setPersonalDetails: (value: string) => void;
  setCompanyInfo: (value: string) => void;
  setCompanyName: (value: string) => void;
  setCompanyUrl: (value: string) => void;
  setPositionTitle: (value: string) => void;
  setSelectedResumeTemplateId: (value: string) => void;
  setSelectedCoverLetterTemplateId: (value: string) => void;
  setCompanyResearch: (value: string) => void;
  setIsResearching: (value: boolean) => void;
  setTailoredResume: (value: string) => void;
  setTailoredCoverLetter: (value: string) => void;
  setJobCountry: (value: string) => void;
  setJobWorkMode: (value: "" | "Remote" | "Hybrid" | "On-site") => void;
  setApplicationQuestions: (value: string) => void;
  setGeneratedAnswers: (value: string) => void;
  setIsGeneratingTailored: (value: boolean) => void;
  setIsGeneratingAnswers: (value: boolean) => void;
  resetAll: () => void;
}

const initialState: AppState = {
  firstName: "",
  lastName: "",
  resumeLatex: "",
  coverLetterLatex: "",
  jobDescription: "",
  personalDetails: "",
  companyInfo: "",
  companyName: "",
  companyUrl: "",
  positionTitle: "",
  selectedResumeTemplateId: "",
  selectedCoverLetterTemplateId: "",
  companyResearch: "",
  isResearching: false,
  tailoredResume: "",
  tailoredCoverLetter: "",
  jobCountry: "",
  jobWorkMode: "",
  applicationQuestions: "",
  generatedAnswers: "",
  isGeneratingTailored: false,
  isGeneratingAnswers: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const setFirstName = (value: string) =>
    setState((prev) => ({ ...prev, firstName: value }));
  const setLastName = (value: string) =>
    setState((prev) => ({ ...prev, lastName: value }));
  const setResumeLatex = (value: string) =>
    setState((prev) => ({ ...prev, resumeLatex: value }));
  const setCoverLetterLatex = (value: string) =>
    setState((prev) => ({ ...prev, coverLetterLatex: value }));
  const setJobDescription = (value: string) =>
    setState((prev) => ({ ...prev, jobDescription: value }));
  const setPersonalDetails = (value: string) =>
    setState((prev) => ({ ...prev, personalDetails: value }));
  const setCompanyInfo = (value: string) =>
    setState((prev) => ({ ...prev, companyInfo: value }));
  const setCompanyName = (value: string) =>
    setState((prev) => ({ ...prev, companyName: value }));
  const setCompanyUrl = (value: string) =>
    setState((prev) => ({ ...prev, companyUrl: value }));
  const setPositionTitle = (value: string) =>
    setState((prev) => ({ ...prev, positionTitle: value }));
  const setSelectedResumeTemplateId = (value: string) =>
    setState((prev) => ({ ...prev, selectedResumeTemplateId: value }));
  const setSelectedCoverLetterTemplateId = (value: string) =>
    setState((prev) => ({ ...prev, selectedCoverLetterTemplateId: value }));
  const setCompanyResearch = (value: string) =>
    setState((prev) => ({ ...prev, companyResearch: value }));
  const setIsResearching = (value: boolean) =>
    setState((prev) => ({ ...prev, isResearching: value }));
  const setTailoredResume = (value: string) =>
    setState((prev) => ({ ...prev, tailoredResume: value }));
  const setTailoredCoverLetter = (value: string) =>
    setState((prev) => ({ ...prev, tailoredCoverLetter: value }));
  const setJobCountry = (value: string) =>
    setState((prev) => ({ ...prev, jobCountry: value }));
  const setJobWorkMode = (value: "" | "Remote" | "Hybrid" | "On-site") =>
    setState((prev) => ({ ...prev, jobWorkMode: value }));
  const setApplicationQuestions = (value: string) =>
    setState((prev) => ({ ...prev, applicationQuestions: value }));
  const setGeneratedAnswers = (value: string) =>
    setState((prev) => ({ ...prev, generatedAnswers: value }));
  const setIsGeneratingTailored = (value: boolean) =>
    setState((prev) => ({ ...prev, isGeneratingTailored: value }));
  const setIsGeneratingAnswers = (value: boolean) =>
    setState((prev) => ({ ...prev, isGeneratingAnswers: value }));
  const resetAll = () => setState(initialState);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setFirstName,
        setLastName,
        setResumeLatex,
        setCoverLetterLatex,
        setJobDescription,
        setPersonalDetails,
        setCompanyInfo,
        setCompanyName,
        setCompanyUrl,
        setPositionTitle,
        setSelectedResumeTemplateId,
        setSelectedCoverLetterTemplateId,
        setCompanyResearch,
        setIsResearching,
        setTailoredResume,
        setTailoredCoverLetter,
        setJobCountry,
        setJobWorkMode,
        setApplicationQuestions,
        setGeneratedAnswers,
        setIsGeneratingTailored,
        setIsGeneratingAnswers,
        resetAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
