"use client";

import { useState, useEffect, memo } from "react";
import Button from "./Button";

interface PDFPreviewProps {
  pdfBase64: string | null;
  compileError: string | null;
  isCompiling: boolean;
  onRetry: () => void;
  onDoubleClick: () => void;
}

/**
 * Lazy-loaded PDF Preview component
 * Only renders the heavy PDF viewer when needed
 */
function PDFPreviewInner({
  pdfBase64,
  compileError,
  isCompiling,
  onRetry,
  onDoubleClick,
}: PDFPreviewProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Delay rendering to improve initial load performance
  useEffect(() => {
    const timer = requestIdleCallback(() => {
      setIsVisible(true);
    });
    return () => cancelIdleCallback(timer);
  }, []);

  if (!isVisible && !pdfBase64 && !compileError && !isCompiling) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="animate-pulse">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted mb-4"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <p className="text-muted text-sm">Loading preview...</p>
      </div>
    );
  }

  if (compileError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.5"
          className="mb-4"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="mb-2 text-sm font-medium text-red-600">Compilation Error</p>
        <p className="max-w-xs font-mono text-xs whitespace-pre-wrap text-red-500">
          {compileError}
        </p>
        <Button onClick={onRetry} variant="secondary" className="mt-4 text-xs">
          Retry Compilation
        </Button>
      </div>
    );
  }

  if (pdfBase64) {
    return (
      <div
        className="flex flex-1 justify-center overflow-auto"
        onDoubleClick={onDoubleClick}
        title="Tip: Select text in PDF, copy it (Ctrl+C), then double-click here to find it in the code"
      >
        <object
          data={`data:application/pdf;base64,${pdfBase64}#toolbar=0&navpanes=0`}
          type="application/pdf"
          className="h-full w-full border-0"
          title="PDF Preview"
        >
          {/* Fallback for browsers that don't support object */}
          <iframe
            src={`data:application/pdf;base64,${pdfBase64}#toolbar=0&navpanes=0`}
            className="h-full w-full border-0"
            title="PDF Preview"
          />
        </object>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      {isCompiling ? (
        <>
          <span className="spinner mb-4" />
          <p className="text-muted text-sm">Compiling LaTeX...</p>
        </>
      ) : (
        <>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted mb-4"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-muted mb-2 text-sm">No preview available</p>
          <p className="text-muted-light text-xs">Enter LaTeX code and click Compile</p>
        </>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const PDFPreview = memo(PDFPreviewInner);

// requestIdleCallback polyfill for Safari
if (typeof window !== "undefined" && !("requestIdleCallback" in window)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).requestIdleCallback = (cb: () => void) => setTimeout(cb, 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}
