"use client";

import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Button from "./Button";

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
  const { tailoredResume, generatedAnswers } = useAppContext();

  const handleStepClick = (stepNumber: number, path: string) => {
    // Allow navigation to any step
    router.push(path);
  };

  // Determine if a step should show as completed based on actual data
  const isStepCompleted = (stepNumber: number): boolean => {
    if (stepNumber >= currentStep) return false;
    
    // Step 1 is completed if we have tailored resume (moved past input)
    if (stepNumber === 1) return !!tailoredResume;
    
    // Step 2 is completed if we have generated answers
    if (stepNumber === 2) return !!generatedAnswers;
    
    return false;
  };

  return (
    <div className="step-indicator-container">
      <div className="step-indicator w-full max-w-52 sm:max-w-xs md:max-w-md mx-auto">
        {steps.map((step, index) => {
          const completed = isStepCompleted(step.number);
          
          return (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <Button
                  onClick={() => handleStepClick(step.number, step.path)}
                  variant="ghost"
                  className={`step-dot cursor-pointer hover:scale-110 transition-transform ${
                    currentStep === step.number
                      ? "active"
                      : completed
                        ? "completed"
                        : "inactive"
                  }`}
                  title={`Go to ${step.label}`}
                >
                  {completed ? (
                    <svg
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5"
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
                </Button>
                <span className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 text-muted hidden sm:block">
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`step-line mx-0.5 sm:mx-1 md:mx-2 ${
                    completed ? "completed" : ""
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
