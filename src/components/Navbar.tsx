"use client";

import Link from "next/link";
import StepIndicator from "./StepIndicator";

interface NavbarProps {
  currentStep: number;
}

export default function Navbar({ currentStep }: NavbarProps) {
  return (
    <nav className="sticky top-2 sm:top-4 z-50 glass-card px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 mb-6 sm:mb-8 mx-auto max-w-6xl mt-2 sm:mt-4">
      <div className="w-full flex items-center justify-between gap-2">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3 shrink-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary flex items-center justify-center">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <span className="text-sm sm:text-base md:text-lg font-bold text-foreground hidden sm:block tracking-tight">
            Final Destination
          </span>
        </Link>

        {/* Center: Step Indicator - Hidden on very small screens */}
        <div className="hidden xs:block absolute left-1/2 transform -translate-x-1/2">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Right: Companies Button */}
        <a
          href="/jobs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs sm:text-sm font-medium transition-colors shrink-0"
        >
          <svg
            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span className="hidden xs:inline">Companies</span>
        </a>
      </div>
    </nav>
  );
}
