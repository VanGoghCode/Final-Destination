"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type JobStatus = "pending" | "researching" | "tailoring-resume" | "tailoring-cover-letter" | "completed" | "failed";

export interface QueuedJob {
  id: string;
  companyName: string;
  companyUrl: string;
  positionTitle: string;
  jobDescription: string;
  personalDetails: string;
  status: JobStatus;
  progress: number; // 0-100
  error?: string;
  // Profile info
  profileId?: string;
  profileName?: string;
  profileColor?: string;
  // Results
  companyResearch?: string;
  tailoredResume?: string;
  tailoredCoverLetter?: string;
  jobCountry?: string;
  jobWorkMode?: "" | "Remote" | "Hybrid" | "On-site";
  // Timestamps
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
}

interface JobQueueContextType {
  // Queue state
  queue: QueuedJob[];
  isProcessing: boolean;
  currentJobId: string | null;
  
  // Queue actions
  addJob: (job: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">) => string;
  addJobs: (jobs: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">[]) => string[];
  removeJob: (id: string) => void;
  updateJob: (id: string, updates: Partial<Pick<QueuedJob, "companyName" | "companyUrl" | "positionTitle" | "jobDescription" | "personalDetails">>) => void;
  clearQueue: () => void;
  clearCompleted: () => void;
  
  // Processing actions
  startProcessing: () => void;
  stopProcessing: () => void;
  retryJob: (id: string) => void;
  
  // Job updates (internal use)
  updateJobStatus: (id: string, status: JobStatus, progress?: number) => void;
  updateJobResults: (id: string, results: Partial<QueuedJob>) => void;
  setJobError: (id: string, error: string) => void;
  
  // Stats
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  totalCount: number;
}

const JobQueueContext = createContext<JobQueueContextType | undefined>(undefined);

export function JobQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Generate unique ID
  const generateId = () => `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add single job
  const addJob = useCallback((job: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">) => {
    const id = generateId();
    const newJob: QueuedJob = {
      ...job,
      id,
      status: "pending",
      progress: 0,
      addedAt: Date.now(),
    };
    setQueue(prev => [...prev, newJob]);
    return id;
  }, []);

  // Add multiple jobs
  const addJobs = useCallback((jobs: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">[]) => {
    const newJobs: QueuedJob[] = jobs.map(job => ({
      ...job,
      id: generateId(),
      status: "pending" as JobStatus,
      progress: 0,
      addedAt: Date.now(),
    }));
    setQueue(prev => [...prev, ...newJobs]);
    return newJobs.map(j => j.id);
  }, []);

  // Remove job
  const removeJob = useCallback((id: string) => {
    setQueue(prev => prev.filter(j => j.id !== id));
  }, []);

  // Update job data and reset to pending (keeps position in queue)
  const updateJob = useCallback((id: string, updates: Partial<Pick<QueuedJob, "companyName" | "companyUrl" | "positionTitle" | "jobDescription" | "personalDetails">>) => {
    setQueue(prev => prev.map(job => 
      job.id === id 
        ? { 
            ...job, 
            ...updates,
            // Reset processing state to restart from beginning
            status: "pending" as JobStatus,
            progress: 0,
            error: undefined,
            startedAt: undefined,
            completedAt: undefined,
            // Clear previous results since we're restarting
            companyResearch: undefined,
            tailoredResume: undefined,
            tailoredCoverLetter: undefined,
            jobCountry: undefined,
            jobWorkMode: undefined,
          } 
        : job
    ));
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
    setIsProcessing(false);
    setCurrentJobId(null);
  }, []);

  // Clear only completed jobs
  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(j => j.status !== "completed"));
  }, []);

  // Update job status
  const updateJobStatus = useCallback((id: string, status: JobStatus, progress?: number) => {
    setQueue(prev => prev.map(job => {
      if (job.id !== id) return job;
      
      const updates: Partial<QueuedJob> = { status };
      if (progress !== undefined) updates.progress = progress;
      if (status !== "pending" && !job.startedAt) updates.startedAt = Date.now();
      if (status === "completed" || status === "failed") updates.completedAt = Date.now();
      
      return { ...job, ...updates };
    }));
  }, []);

  // Update job results
  const updateJobResults = useCallback((id: string, results: Partial<QueuedJob>) => {
    setQueue(prev => prev.map(job => 
      job.id === id ? { ...job, ...results } : job
    ));
  }, []);

  // Set job error
  const setJobError = useCallback((id: string, error: string) => {
    setQueue(prev => prev.map(job => 
      job.id === id ? { ...job, status: "failed" as JobStatus, error, completedAt: Date.now() } : job
    ));
  }, []);

  // Start processing
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
  }, []);

  // Stop processing
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    setCurrentJobId(null);
  }, []);

  // Retry failed job
  const retryJob = useCallback((id: string) => {
    setQueue(prev => prev.map(job => 
      job.id === id 
        ? { ...job, status: "pending" as JobStatus, progress: 0, error: undefined, startedAt: undefined, completedAt: undefined }
        : job
    ));
  }, []);

  // Computed stats
  const completedCount = queue.filter(j => j.status === "completed").length;
  const failedCount = queue.filter(j => j.status === "failed").length;
  const pendingCount = queue.filter(j => j.status === "pending").length;
  const totalCount = queue.length;

  return (
    <JobQueueContext.Provider
      value={{
        queue,
        isProcessing,
        currentJobId,
        addJob,
        addJobs,
        removeJob,
        updateJob,
        clearQueue,
        clearCompleted,
        startProcessing,
        stopProcessing,
        retryJob,
        updateJobStatus,
        updateJobResults,
        setJobError,
        completedCount,
        failedCount,
        pendingCount,
        totalCount,
      }}
    >
      {children}
    </JobQueueContext.Provider>
  );
}

export function useJobQueue() {
  const context = useContext(JobQueueContext);
  if (context === undefined) {
    throw new Error("useJobQueue must be used within a JobQueueProvider");
  }
  return context;
}
