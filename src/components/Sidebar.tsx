"use client";

import { useEffect, useState } from "react";
import Button from "./Button";

interface SidebarProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function Sidebar({ title, subtitle, children, defaultOpen = true }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultOpen);
  const [isMobile, setIsMobile] = useState(false);

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
            : `h-screen ${sidebarOpen ? "w-80" : "w-12"}`
        }`}
        onClick={(e) => {
          if (isMobile && e.target === e.currentTarget) setSidebarOpen(false);
        }}
      >
        <div
          className={`h-full bg-white border-r border-gray-200 flex flex-col w-80 transition-transform duration-300 ${
            isMobile
              ? `max-w-sm shadow-2xl ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
              : `${sidebarOpen ? "translate-x-0" : "-translate-x-67"}`
          }`}
        >
          {/* Sidebar Header with Logo and Toggle */}
          <div className="h-14 flex items-center justify-between px-3 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
            <div className="flex items-center gap-2">
              <img src="/logo.png?v=2" alt="Logo" className="w-8 h-8 rounded-lg" />
              <span className="font-bold text-sm gradient-text">{title}</span>
            </div>
            {!isMobile && (
              <Button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                variant="ghost"
                className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50"
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <svg
                  className={`w-4 h-4 text-gray-600 transition-transform ${sidebarOpen ? "" : "rotate-180"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
            )}
          </div>

          <div
            className={`flex flex-col flex-1 overflow-hidden transition-opacity ${
              sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {/* Sidebar Subtitle */}
            {subtitle && (
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-muted">{subtitle}</p>
              </div>
            )}

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Toggle */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-6 left-6 z-30 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
    </>
  );
}
