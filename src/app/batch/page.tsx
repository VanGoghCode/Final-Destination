"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useJobQueue, QueuedJob } from "@/context/JobQueueContext";
import { useAppContext } from "@/context/AppContext";
import Sidebar from "@/components/Sidebar";
import Button from "@/components/Button";
import JobQueueCard from "@/components/JobQueueCard";
import QueueProgress from "@/components/QueueProgress";
import {
  getDefaultResumeTemplate,
  getDefaultCoverLetterTemplate,
  Template,
} from "@/lib/storage";

// Add Job Modal Component
function AddJobModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (job: { companyName: string; companyUrl: string; positionTitle: string; jobDescription: string; personalDetails: string }) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [personalDetails, setPersonalDetails] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !positionTitle.trim() || !jobDescription.trim()) return;
    onAdd({ companyName, companyUrl, positionTitle, jobDescription, personalDetails });
    // Reset form
    setCompanyName("");
    setCompanyUrl("");
    setPositionTitle("");
    setJobDescription("");
    setPersonalDetails("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Add Job to Queue</h2>
          <p className="text-sm text-muted mt-1">Fill in the job details to add to batch processing</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Company Name *</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. Google"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Position Title *</label>
              <input
                type="text"
                value={positionTitle}
                onChange={e => setPositionTitle(e.target.value)}
                className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. Software Engineer"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Company URL (optional)</label>
            <input
              type="url"
              value={companyUrl}
              onChange={e => setCompanyUrl(e.target.value)}
              className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="https://careers.google.com/..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Job Description *</label>
            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              rows={6}
              placeholder="Paste the job description here..."
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Additional Details (optional)</label>
            <textarea
              value={personalDetails}
              onChange={e => setPersonalDetails(e.target.value)}
              className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              rows={3}
              placeholder="Any specific points you want highlighted..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Add to Queue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View Results Modal
function ResultsModal({
  job,
  isOpen,
  onClose,
}: {
  job: QueuedJob | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { setTailoredResume, setTailoredCoverLetter, setCompanyName, setPositionTitle, setJobDescription, setCompanyInfo, setJobCountry, setJobWorkMode } = useAppContext();
  const [activeTab, setActiveTab] = useState<"resume" | "cover-letter">("resume");

  if (!isOpen || !job) return null;

  const handleUseResults = () => {
    // Load results into app context and go to tailored page
    if (job.tailoredResume) setTailoredResume(job.tailoredResume);
    if (job.tailoredCoverLetter) setTailoredCoverLetter(job.tailoredCoverLetter);
    setCompanyName(job.companyName);
    setPositionTitle(job.positionTitle);
    setJobDescription(job.jobDescription);
    if (job.companyResearch) setCompanyInfo(job.companyResearch);
    if (job.jobCountry) setJobCountry(job.jobCountry);
    if (job.jobWorkMode) setJobWorkMode(job.jobWorkMode);
    router.push("/tailored");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{job.companyName}</h2>
            <p className="text-sm text-muted">{job.positionTitle}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleUseResults}>
              Use These Results
            </Button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab("resume")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "resume" ? "text-primary border-b-2 border-primary" : "text-muted hover:text-foreground"
            }`}
          >
            Tailored Resume
          </button>
          <button
            onClick={() => setActiveTab("cover-letter")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "cover-letter" ? "text-primary border-b-2 border-primary" : "text-muted hover:text-foreground"
            }`}
          >
            Tailored Cover Letter
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="font-mono text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
            {activeTab === "resume" ? (job.tailoredResume || "No resume generated") : (job.tailoredCoverLetter || "No cover letter generated")}
          </pre>
        </div>
      </div>
    </div>
  );
}

// Live Activity Feed Component
function ActivityFeed({ currentJob, recentActivities }: { currentJob: QueuedJob | null; recentActivities: string[] }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 text-green-400 font-mono text-xs overflow-hidden">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-500 font-semibold">LIVE ACTIVITY</span>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {currentJob && (
          <div className="flex gap-2">
            <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>
            <span>Processing: {currentJob.companyName} - {currentJob.positionTitle}</span>
          </div>
        )}
        {recentActivities.map((activity, i) => (
          <div key={i} className="flex gap-2 text-gray-400">
            <span className="text-gray-600">[{new Date(Date.now() - i * 5000).toLocaleTimeString()}]</span>
            <span>{activity}</span>
          </div>
        ))}
        {!currentJob && recentActivities.length === 0 && (
          <div className="text-gray-500">Waiting for jobs...</div>
        )}
      </div>
    </div>
  );
}

export default function BatchProcessPage() {
  const router = useRouter();
  const {
    queue,
    isProcessing,
    currentJobId,
    addJob,
    removeJob,
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
  } = useJobQueue();

  const { personalDetails: globalPersonalDetails } = useAppContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingJob, setViewingJob] = useState<QueuedJob | null>(null);
  const [recentActivities, setRecentActivities] = useState<string[]>([]);
  const [resumeTemplate, setResumeTemplate] = useState<Template | null>(null);
  const [coverLetterTemplate, setCoverLetterTemplate] = useState<Template | null>(null);

  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load templates on mount
  useEffect(() => {
    const defaultResume = getDefaultResumeTemplate();
    const defaultCoverLetter = getDefaultCoverLetterTemplate();
    if (defaultResume) setResumeTemplate(defaultResume);
    if (defaultCoverLetter) setCoverLetterTemplate(defaultCoverLetter);
  }, []);

  // Add activity log
  const addActivity = useCallback((message: string) => {
    setRecentActivities(prev => [message, ...prev.slice(0, 9)]);
  }, []);

  // Process a single job
  const processJob = useCallback(async (job: QueuedJob, signal: AbortSignal) => {
    if (!resumeTemplate) {
      setJobError(job.id, "No default resume template set");
      return;
    }

    try {
      // Step 1: Research company (20%)
      updateJobStatus(job.id, "researching", 10);
      addActivity(`Researching ${job.companyName}...`);

      const researchResponse = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: job.companyName,
          companyUrl: job.companyUrl,
          positionTitle: job.positionTitle,
          jobDescription: job.jobDescription,
        }),
        signal,
      });

      if (!researchResponse.ok) {
        const data = await researchResponse.json();
        throw new Error(data.error || "Research failed");
      }

      const researchData = await researchResponse.json();
      updateJobResults(job.id, { companyResearch: researchData.research });
      updateJobStatus(job.id, "researching", 30);
      addActivity(`Research complete for ${job.companyName}`);

      // Step 2: Tailor resume (60%)
      updateJobStatus(job.id, "tailoring-resume", 40);
      addActivity(`Tailoring resume for ${job.positionTitle}...`);

      const tailorResponse = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeLatex: resumeTemplate.content,
          jobDescription: job.jobDescription,
          personalDetails: job.personalDetails || globalPersonalDetails,
          companyInfo: researchData.research,
          companyName: job.companyName,
        }),
        signal,
      });

      if (!tailorResponse.ok) {
        const data = await tailorResponse.json();
        throw new Error(data.error || "Resume tailoring failed");
      }

      const tailorData = await tailorResponse.json();
      updateJobResults(job.id, { 
        tailoredResume: tailorData.tailoredResume,
        jobCountry: tailorData.jobCountry,
        jobWorkMode: tailorData.jobWorkMode,
      });
      updateJobStatus(job.id, "tailoring-resume", 60);
      addActivity(`Resume tailored for ${job.companyName}`);

      // Step 3: Tailor cover letter (100%)
      if (coverLetterTemplate) {
        updateJobStatus(job.id, "tailoring-cover-letter", 70);
        addActivity(`Generating cover letter for ${job.positionTitle}...`);

        const coverLetterResponse = await fetch("/api/tailor-cover-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coverLetterLatex: coverLetterTemplate.content,
            jobDescription: job.jobDescription,
            personalDetails: job.personalDetails || globalPersonalDetails,
            companyInfo: researchData.research,
          }),
          signal,
        });

        if (!coverLetterResponse.ok) {
          const data = await coverLetterResponse.json();
          throw new Error(data.error || "Cover letter generation failed");
        }

        const coverLetterData = await coverLetterResponse.json();
        updateJobResults(job.id, { tailoredCoverLetter: coverLetterData.tailoredCoverLetter });
        addActivity(`Cover letter generated for ${job.companyName}`);
      }

      // Mark completed
      updateJobStatus(job.id, "completed", 100);
      addActivity(`✓ Completed: ${job.companyName} - ${job.positionTitle}`);

    } catch (error) {
      if ((error as Error).name === "AbortError") {
        addActivity(`Cancelled: ${job.companyName}`);
        updateJobStatus(job.id, "pending", 0);
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        setJobError(job.id, message);
        addActivity(`✗ Failed: ${job.companyName} - ${message}`);
      }
    }
  }, [resumeTemplate, coverLetterTemplate, globalPersonalDetails, updateJobStatus, updateJobResults, setJobError, addActivity]);

  // Main processing loop
  useEffect(() => {
    if (!isProcessing || processingRef.current) return;

    const processQueue = async () => {
      processingRef.current = true;
      abortControllerRef.current = new AbortController();

      const pendingJobs = queue.filter(j => j.status === "pending");
      
      for (const job of pendingJobs) {
        if (!isProcessing || abortControllerRef.current?.signal.aborted) break;
        await processJob(job, abortControllerRef.current.signal);
        // Small delay between jobs to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      processingRef.current = false;
      if (queue.filter(j => j.status === "pending").length === 0) {
        stopProcessing();
      }
    };

    processQueue();
  }, [isProcessing, queue, processJob, stopProcessing]);

  // Handle stop processing
  const handleStopProcessing = () => {
    abortControllerRef.current?.abort();
    stopProcessing();
    processingRef.current = false;
  };

  // Handle add job
  const handleAddJob = (jobData: { companyName: string; companyUrl: string; positionTitle: string; jobDescription: string; personalDetails: string }) => {
    addJob(jobData);
    addActivity(`Added: ${jobData.companyName} - ${jobData.positionTitle}`);
  };

  const currentJob = queue.find(j => j.id === currentJobId) || queue.find(j => ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(j.status));

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar title="Batch Process" subtitle="Process multiple applications">
        {/* Navigation */}
        <div className="p-3 border-b border-gray-100">
          <button
            onClick={() => router.push("/")}
            className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Single Mode
          </button>
        </div>

        {/* Queue Stats */}
        <div className="p-4 border-b border-gray-100">
          <QueueProgress
            total={totalCount}
            completed={completedCount}
            failed={failedCount}
            pending={pendingCount}
            isProcessing={isProcessing}
          />
        </div>

        {/* Templates Status */}
        <div className="p-4 border-b border-gray-100 space-y-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Templates</h3>
          <div className="space-y-1.5">
            <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${resumeTemplate ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <div className={`w-2 h-2 rounded-full ${resumeTemplate ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-medium">Resume:</span>
              <span className="truncate">{resumeTemplate?.name || "Not set"}</span>
            </div>
            <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${coverLetterTemplate ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              <div className={`w-2 h-2 rounded-full ${coverLetterTemplate ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="font-medium">Cover Letter:</span>
              <span className="truncate">{coverLetterTemplate?.name || "Optional"}</span>
            </div>
          </div>
          {!resumeTemplate && (
            <button
              onClick={() => router.push("/")}
              className="w-full text-xs text-primary hover:underline mt-2"
            >
              Set up templates first →
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <Button
            onClick={() => setShowAddModal(true)}
            variant="primary"
            className="w-full justify-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Job
          </Button>
          
          {pendingCount > 0 && !isProcessing && (
            <Button
              onClick={startProcessing}
              variant="secondary"
              className="w-full justify-center"
              disabled={!resumeTemplate}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Processing ({pendingCount})
            </Button>
          )}
          
          {isProcessing && (
            <Button
              onClick={handleStopProcessing}
              variant="secondary"
              className="w-full justify-center bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop Processing
            </Button>
          )}

          {completedCount > 0 && (
            <button
              onClick={clearCompleted}
              className="w-full text-xs text-muted hover:text-foreground py-2 transition-colors"
            >
              Clear completed ({completedCount})
            </button>
          )}
          
          {totalCount > 0 && !isProcessing && (
            <button
              onClick={clearQueue}
              className="w-full text-xs text-red-500 hover:text-red-700 py-2 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Batch Processing</h1>
              <p className="text-sm text-muted mt-1">
                Add multiple jobs and process them all at once
              </p>
            </div>
            {isProcessing && currentJob && (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium">Processing: {currentJob.companyName}</span>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <ActivityFeed currentJob={currentJob || null} recentActivities={recentActivities} />

          {/* Queue List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Job Queue</h2>
              <span className="text-xs text-muted">{totalCount} job{totalCount !== 1 ? 's' : ''}</span>
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="text-lg font-medium text-gray-600 mb-2">No jobs in queue</h3>
                <p className="text-sm text-muted mb-4">Add jobs to start batch processing your applications</p>
                <Button onClick={() => setShowAddModal(true)} variant="primary">
                  Add Your First Job
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {queue.map(job => (
                  <JobQueueCard
                    key={job.id}
                    job={job}
                    onRemove={() => removeJob(job.id)}
                    onRetry={() => retryJob(job.id)}
                    onView={() => setViewingJob(job)}
                    isCurrentJob={currentJob?.id === job.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          {queue.length > 0 && !isProcessing && pendingCount > 0 && resumeTemplate && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Ready to process</p>
                <p className="mt-1 text-blue-700">
                  Click "Start Processing" to begin. Each job will be researched, then your resume and cover letter will be tailored automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AddJobModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddJob} />
      <ResultsModal job={viewingJob} isOpen={!!viewingJob} onClose={() => setViewingJob(null)} />
    </div>
  );
}
