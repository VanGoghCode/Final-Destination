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
  };
  profiles: Profile[];
  onSubmit: (data: {
    companyName: string;
    companyUrl: string;
    positionTitle: string;
    jobDescription: string;
    personalDetails: string;
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
  },
  profiles,
  onSubmit,
  onCancel,
  submitLabel,
  isProcessing,
}: JobFormProps) {
  const [companyName, setCompanyName] = useState(initialValues.companyName);
  const [companyUrl, setCompanyUrl] = useState(initialValues.companyUrl);
  const [positionTitle, setPositionTitle] = useState(
    initialValues.positionTitle,
  );
  const [jobDescription, setJobDescription] = useState(
    initialValues.jobDescription,
  );
  const [personalDetails, setPersonalDetails] = useState(
    initialValues.personalDetails,
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    initialValues.profileId || "",
  );
  const [showAdvanced, setShowAdvanced] = useState(
    !!initialValues.personalDetails,
  );

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
      profileId: selectedProfileId || undefined,
      profileName: selectedProfile?.name,
      profileColor: selectedProfile?.color,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {/* Profile Selection */}
      {profiles.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-muted mb-2">
            Select Profile
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedProfileId("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !selectedProfileId
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              Default
            </button>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedProfileId(profile.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedProfileId === profile.id
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-muted hover:bg-gray-200"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-gradient-to-br ${profile.color} flex items-center justify-center text-white text-[8px] font-bold`}
                >
                  {profile.avatarText || profile.firstName[0]}
                </span>
                {profile.name}
              </button>
            ))}
          </div>
          {selectedProfile && (
            <p className="text-[10px] text-green-600 mt-1">
              Using {selectedProfile.firstName} {selectedProfile.lastName}
              &apos;s templates
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Company Name *
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="e.g. Google"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Position Title *
          </label>
          <input
            type="text"
            value={positionTitle}
            onChange={(e) => setPositionTitle(e.target.value)}
            className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="e.g. Software Engineer"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Job Posting URL *
        </label>
        <input
          type="url"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
          className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder="https://careers.google.com/jobs/..."
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Job Description *
        </label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          rows={6}
          placeholder="Paste the job description here..."
          required
        />
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        Advanced Options
      </button>

      {showAdvanced && (
        <div className="space-y-4 pl-4 border-l-2 border-gray-100">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Additional Details (optional)
            </label>
            <textarea
              value={personalDetails}
              onChange={(e) => setPersonalDetails(e.target.value)}
              className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              rows={2}
              placeholder="Any specific points you want highlighted..."
            />
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="p-3 bg-yellow-50 text-yellow-800 text-xs rounded-lg">
          <strong>Note:</strong> Editing will restart the job processing from
          the beginning.
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1 justify-center"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
