"use client";

import { useRouter } from "next/navigation";

interface StepIndicatorProps {
  currentStep: number;
}

const steps = [
  { number: 1, label: "Input", path: "/" },
  { number: 2, label: "Tailored", path: "/tailored" },
  { number: 3, label: "Q&A", path: "/questions" },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const router = useRouter();

  const handleStepClick = (stepNumber: number, path: string) => {
    // Allow navigation to any step
    router.push(path);
  };

  return (
    <div className="step-indicator w-full max-w-xs sm:max-w-md mx-auto">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <button
              onClick={() => handleStepClick(step.number, step.path)}
              className={`step-dot cursor-pointer hover:scale-110 transition-transform ${
                currentStep === step.number
                  ? "active"
                  : currentStep > step.number
                    ? "completed"
                    : "inactive"
              }`}
              title={`Go to ${step.label}`}
            >
              {currentStep > step.number ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step.number
              )}
            </button>
            <span className="text-xs mt-1 text-muted hidden sm:block">
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`step-line mx-1 sm:mx-2 ${
                currentStep > step.number ? "completed" : ""
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
