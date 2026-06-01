import { useState } from "react";
import Button from "@/components/Button";
import { Profile } from "@/lib/storage";

interface JobFormProps {
  initialValues?: {
    companyName: string;
    companyUrl: string;
    positionTitle: string;
    jobDescription: string;
    personalDetails: string;
    profileId: string;
    includeCoverLetter: boolean;
  };
  profiles: Profile[];
  onSubmit: (data: {
    companyName: string;
    companyUrl: string;
    positionTitle: string;
    jobDescription: string;
    personalDetails: string;
    includeCoverLetter: boolean;
    profileId?: string;
    profileName?: string;
    profileColor?: string;
  }) => void;
  onCancel: () => void;
  submitLabel: React.ReactNode;
  isProcessing?: boolean;
}

export default function JobForm({
  initialValues = {
    companyName: "",
    companyUrl: "",
    positionTitle: "",
    jobDescription: "",
    personalDetails: "",
    profileId: "",
    includeCoverLetter: false,
  },
  profiles,
  onSubmit,
  onCancel,
  submitLabel,
  isProcessing,
}: JobFormProps) {
  const [companyName, setCompanyName] = useState(initialValues.companyName);
  const [companyUrl, setCompanyUrl] = useState(initialValues.companyUrl);
  const [positionTitle, setPositionTitle] = useState(initialValues.positionTitle);
  const [jobDescription, setJobDescription] = useState(initialValues.jobDescription);
  const [personalDetails, setPersonalDetails] = useState(initialValues.personalDetails);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(initialValues.profileId || "");
  const [includeCoverLetter, setIncludeCoverLetter] = useState(
    initialValues.includeCoverLetter || false,
  );
  const [showAdvanced, setShowAdvanced] = useState(!!initialValues.personalDetails);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !companyName.trim() ||
      !companyUrl.trim() ||
      !positionTitle.trim() ||
      !jobDescription.trim()
    )
      return;

    onSubmit({
      companyName: companyName.trim(),
      companyUrl: companyUrl.trim(),
      positionTitle: positionTitle.trim(),
      jobDescription: jobDescription.trim(),
      personalDetails: personalDetails.trim(),
      includeCoverLetter,
      profileId: selectedProfileId || undefined,
      profileName: selectedProfile?.name,
      profileColor: selectedProfile?.color,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6">
      {/* Profile Selection */}
      {profiles.length > 0 && (
        <div>
          <label className="text-muted mb-2 block text-xs font-medium">Select Profile</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedProfileId("")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                !selectedProfileId
                  ? "bg-primary text-white"
                  : "text-muted bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Default
            </button>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedProfileId(profile.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedProfileId === profile.id
                    ? "bg-primary text-white"
                    : "text-muted bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-gradient-to-br ${profile.color} flex items-center justify-center text-[8px] font-bold text-white`}
                >
                  {profile.avatarText || profile.firstName[0]}
                </span>
                {profile.name}
              </button>
            ))}
          </div>
          {selectedProfile && (
            <p className="mt-1 text-[10px] text-green-600">
              Using {selectedProfile.firstName} {selectedProfile.lastName}
              &apos;s templates
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Company Name *</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="border-card-border focus:ring-primary/20 focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            placeholder="e.g. Google"
            required
          />
        </div>
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Position Title *</label>
          <input
            type="text"
            value={positionTitle}
            onChange={(e) => setPositionTitle(e.target.value)}
            className="border-card-border focus:ring-primary/20 focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            placeholder="e.g. Software Engineer"
            required
          />
        </div>
      </div>

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Job Posting URL *</label>
        <input
          type="url"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
          className="border-card-border focus:ring-primary/20 focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          placeholder="https://careers.google.com/jobs/..."
          required
        />
      </div>

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Job Description *</label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="border-card-border focus:ring-primary/20 focus:border-primary w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          rows={6}
          placeholder="Paste the job description here..."
          required
        />
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-muted hover:text-foreground flex items-center gap-1 text-xs"
      >
        <svg
          className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        Advanced Options
      </button>

      <div className="flex items-center gap-2 px-1">
        <input
          type="checkbox"
          id="includeCoverLetter"
          checked={includeCoverLetter}
          onChange={(e) => setIncludeCoverLetter(e.target.checked)}
          className="text-primary focus:ring-primary/20 h-4 w-4 rounded border-gray-300"
        />
        <label
          htmlFor="includeCoverLetter"
          className="cursor-pointer text-xs font-medium text-gray-700"
        >
          Generate Cover Letter
        </label>
      </div>

      {showAdvanced && (
        <div className="space-y-4 border-l-2 border-gray-100 pl-4">
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">
              Additional Details (optional)
            </label>
            <textarea
              value={personalDetails}
              onChange={(e) => setPersonalDetails(e.target.value)}
              className="border-card-border focus:ring-primary/20 focus:border-primary w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              rows={2}
              placeholder="Any specific points you want highlighted..."
            />
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800">
          <strong>Note:</strong> Editing will restart the job processing from the beginning.
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1 justify-center">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
