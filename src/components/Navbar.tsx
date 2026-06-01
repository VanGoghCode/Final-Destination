"use client";

import Link from "next/link";
import Image from "next/image";
import StepIndicator from "./StepIndicator";
import Button from "./Button";

interface NavbarProps {
  currentStep: number;
}

export default function Navbar({ currentStep }: NavbarProps) {
  return (
    <nav className="glass-card glass-navbar sticky top-2 z-50 mx-auto mt-2 mb-6 max-w-6xl px-3 py-2.5 sm:top-4 sm:mt-4 sm:mb-8 sm:px-4 sm:py-3 md:px-6 md:py-4">
      <div className="flex w-full items-center justify-between gap-2">
        {/* Left: Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl sm:h-9 sm:w-9">
            <Image
              src="/logo.png?v=2"
              alt="Final Destination Logo"
              width={36}
              height={36}
              className="h-full w-full object-cover"
              priority
              unoptimized
            />
          </div>
          <span className="text-foreground hidden text-sm font-bold tracking-tight sm:block sm:text-base md:text-lg">
            Final Destination
          </span>
        </Link>

        {/* Center: Step Indicator - Hidden on very small screens */}
        <div className="xs:block absolute left-1/2 hidden -translate-x-1/2 transform">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Right: Companies Button */}
        <Button
          as="a"
          href="/jobs"
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          className="shrink-0 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
        >
          <svg
            className="h-3.5 w-3.5 sm:h-4 sm:w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span className="xs:inline hidden">Companies</span>
        </Button>
      </div>
    </nav>
  );
}
