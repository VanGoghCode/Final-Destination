"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "./Button";
import ModelSelector from "./ModelSelector";
import { hasAdminKey } from "@/lib/client-admin";

interface SidebarProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  hideModelSelector?: boolean;
}

export default function Sidebar({
  title,
  subtitle,
  children,
  defaultOpen = true,
  hideModelSelector = false,
}: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultOpen);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin] = useState(() => {
    if (typeof window !== "undefined") {
      return hasAdminKey();
    }
    return false;
  });

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(defaultOpen);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, [defaultOpen]);

  return (
    <>
      {/* Collapsible Sidebar */}
      <div
        className={`shrink-0 overflow-visible ${
          isMobile
            ? `fixed inset-0 z-40 ${sidebarOpen ? "bg-black/50" : "pointer-events-none"}`
            : `sticky top-0 h-screen ${sidebarOpen ? "w-80" : "w-12"}`
        }`}
        onClick={(e) => {
          if (isMobile && e.target === e.currentTarget) setSidebarOpen(false);
        }}
      >
        <div
          className={`flex h-full w-80 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ${
            isMobile
              ? `max-w-sm shadow-2xl ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
              : `${sidebarOpen ? "translate-x-0" : "-translate-x-67"}`
          }`}
        >
          {/* Sidebar Header with Logo and Toggle */}
          <div className="flex h-14 items-center justify-between border-b border-gray-100 bg-linear-to-r from-gray-50 to-white px-3">
            <div className="flex items-center gap-2">
              <Image src="/logo.png?v=2" alt="Logo" width={32} height={32} className="rounded-lg" />
              <span className="gradient-text text-sm font-bold">{title}</span>
            </div>
            {!isMobile && (
              <Button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                variant="ghost"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white shadow-sm hover:bg-gray-50"
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <svg
                  className={`h-4 w-4 text-gray-600 transition-transform ${sidebarOpen ? "" : "rotate-180"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Button>
            )}
          </div>

          {/* AI Provider Selection */}
          {!hideModelSelector && (
            <div
              className={`border-b border-gray-100 bg-gray-50/50 px-4 py-3 transition-opacity ${
                sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <ModelSelector />
            </div>
          )}

          <div
            className={`flex flex-1 flex-col overflow-hidden transition-opacity ${
              sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* Sidebar Subtitle */}
            {subtitle && (
              <div className="border-b border-gray-100 px-4 py-2">
                <p className="text-muted text-xs">{subtitle}</p>
              </div>
            )}

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">{children}</div>

            {/* Admin Link at the bottom */}
            {isAdmin && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                <Link
                  href="/admin"
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  Admin Panel
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Toggle */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="bg-primary hover:bg-primary/90 fixed bottom-6 left-6 z-30 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-colors"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
    </>
  );
}
