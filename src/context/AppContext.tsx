"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AppState {
  // Step 1 inputs
  resumeLatex: string;
  coverLetterLatex: string;
  jobDescription: string;
  personalDetails: string;
  companyInfo: string;
  companyName: string;
  positionTitle: string;

  // Step 2 outputs
  tailoredResume: string;
  tailoredCoverLetter: string;

  // Step 3
  applicationQuestions: string;
  generatedAnswers: string;

  // Loading states
  isGeneratingTailored: boolean;
  isGeneratingAnswers: boolean;
}

interface AppContextType extends AppState {
  setResumeLatex: (value: string) => void;
  setCoverLetterLatex: (value: string) => void;
  setJobDescription: (value: string) => void;
  setPersonalDetails: (value: string) => void;
  setCompanyInfo: (value: string) => void;
  setCompanyName: (value: string) => void;
  setPositionTitle: (value: string) => void;
  setTailoredResume: (value: string) => void;
  setTailoredCoverLetter: (value: string) => void;
  setApplicationQuestions: (value: string) => void;
  setGeneratedAnswers: (value: string) => void;
  setIsGeneratingTailored: (value: boolean) => void;
  setIsGeneratingAnswers: (value: boolean) => void;
  resetAll: () => void;
}

const initialState: AppState = {
  resumeLatex: "",
  coverLetterLatex: "",
  jobDescription: "",
  personalDetails: "",
  companyInfo: "",
  companyName: "",
  positionTitle: "",
  tailoredResume: "",
  tailoredCoverLetter: "",
  applicationQuestions: "",
  generatedAnswers: "",
  isGeneratingTailored: false,
  isGeneratingAnswers: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

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
  const setPositionTitle = (value: string) =>
    setState((prev) => ({ ...prev, positionTitle: value }));
  const setTailoredResume = (value: string) =>
    setState((prev) => ({ ...prev, tailoredResume: value }));
  const setTailoredCoverLetter = (value: string) =>
    setState((prev) => ({ ...prev, tailoredCoverLetter: value }));
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
        setResumeLatex,
        setCoverLetterLatex,
        setJobDescription,
        setPersonalDetails,
        setCompanyInfo,
        setCompanyName,
        setPositionTitle,
        setTailoredResume,
        setTailoredCoverLetter,
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
