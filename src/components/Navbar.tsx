"use client";

import Link from "next/link";
import StepIndicator from "./StepIndicator";

interface NavbarProps {
  currentStep: number;
}

export default function Navbar({ currentStep }: NavbarProps) {
  return (
    <nav className="sticky top-4 z-50 glass-card px-4 sm:px-6 py-3 sm:py-4 mb-8 mx-auto max-w-6xl mt-4">
      <div className="w-full flex items-center justify-between">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3 flex-shrink-0"
        >
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <svg
              width="20"
              height="20"
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
          <span className="text-base sm:text-lg font-bold text-foreground hidden sm:block tracking-tight">
            Final Destination
          </span>
        </Link>

        {/* Center: Step Indicator */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Right: Companies Button */}
        <a
          href="/jobs"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors flex-shrink-0"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          Companies
        </a>
      </div>
    </nav>
  );
}
