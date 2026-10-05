"use client";

import Link from "next/link";
import Image from "next/image";
import StepIndicator from "./StepIndicator";

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
      </div>
    </nav>
  );
}
