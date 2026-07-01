"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import CopyButton from "./CopyButton";
import Button from "./Button";

// Lazy load the PDF preview component
const PDFPreview = lazy(() => import("./PDFPreview").then((mod) => ({ default: mod.PDFPreview })));

interface LaTeXEditorProps {
  code: string;
  title: string;
  onCodeChange?: (code: string) => void;
  onRegenerate?: (comment: string) => Promise<void>;
  isRegenerating?: boolean;
  showPreview?: boolean;
  fullHeight?: boolean;
  downloadFileName?: string;
  jobUrl?: string;
  onApply?: () => void; // Callback after download to redirect
}

export default function LaTeXEditor({
  code,
  title,
  onCodeChange,
  onRegenerate,
  isRegenerating = false,
  showPreview = true,
  fullHeight = false,
  downloadFileName,
  jobUrl,
  onApply,
}: LaTeXEditorProps) {
  const [editableCode, setEditableCode] = useState(code);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null); // Store base64 for Edge compatibility
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [comment, setComment] = useState("");
  const [viewMode, setViewMode] = useState<"split" | "code" | "preview">("split");
  const [isEditing, setIsEditing] = useState(false);
  const [autoCompile, setAutoCompile] = useState(false); // Auto-compile OFF by default
  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  // Replace state
  const [showReplace, setShowReplace] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState("");
  const compileTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Sync with external code changes
  useEffect(() => {
    if (!isEditing) {
      setEditableCode(code);
    }
  }, [code, isEditing]);

  // Compile LaTeX to PDF
  const compileLatex = useCallback(
    async (latexCode: string) => {
      if (!latexCode.trim()) {
        setPdfUrl(null);
        setPdfBase64(null);
        return;
      }

      setIsCompiling(true);
      setCompileError(null);

      try {
        const response = await fetch("/api/latex-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latex: latexCode }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Compilation failed");
        }

        // Store base64 for Edge compatibility (data URL approach)
        setPdfBase64(data.pdf);

        // Create blob URL from base64 PDF (for Chrome/Firefox)
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        // Revoke old URL to prevent memory leak
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }

        setPdfUrl(url);
      } catch (err) {
        setCompileError(err instanceof Error ? err.message : "Compilation failed");
        setPdfUrl(null);
        setPdfBase64(null);
      } finally {
        setIsCompiling(false);
      }
    },
    [pdfUrl],
  );

  // Debounced compilation on code change (only when auto-compile is enabled)
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setEditableCode(newCode);
      setIsEditing(true);
      onCodeChange?.(newCode);

      // Clear existing timeout
      if (compileTimeoutRef.current) {
        clearTimeout(compileTimeoutRef.current);
      }

      // Only auto-compile if enabled
      if (autoCompile) {
        compileTimeoutRef.current = setTimeout(() => {
          compileLatex(newCode);
        }, 1500);
      }
    },
    [compileLatex, onCodeChange, autoCompile],
  );

  // Handle CTRL+S to compile, CTRL+F to search, CTRL+H to replace
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (compileTimeoutRef.current) {
          clearTimeout(compileTimeoutRef.current);
        }
        compileLatex(editableCode);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
        setShowReplace(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        setShowSearch(true);
        setShowReplace(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setShowReplace(false);
        setSearchQuery("");
        setReplaceQuery("");
        setSearchMatches([]);
      }
    },
    [compileLatex, editableCode, showSearch],
  );

  // Manual compile button
  const handleManualCompile = () => {
    if (compileTimeoutRef.current) {
      clearTimeout(compileTimeoutRef.current);
    }
    compileLatex(editableCode);
  };

  // Scroll to match position in textarea
  const scrollToMatch = useCallback(
    (position: number, length: number, shouldFocus = false) => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;

      // Calculate scroll position first
      const textBeforeMatch = editableCode.substring(0, position);
      const linesBefore = textBeforeMatch.split("\n").length - 1;
      const lineHeight = 20; // approximate line height
      const scrollTop = Math.max(0, linesBefore * lineHeight - 100);
      textarea.scrollTop = scrollTop;

      // Focus textarea and set selection (this highlights the match and keeps it visible)
      if (shouldFocus) {
        textarea.focus();
      }
      textarea.setSelectionRange(position, position + length);
    },
    [editableCode],
  );

  const findMatches = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setSearchMatches([]);
        setCurrentMatchIndex(0);
        return;
      }
      const matches: number[] = [];
      const lowerCode = editableCode.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let index = 0;
      while ((index = lowerCode.indexOf(lowerQuery, index)) !== -1) {
        matches.push(index);
        index += 1;
      }
      setSearchMatches(matches);
      setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
      if (matches.length > 0 && matches[0] !== undefined) {
        scrollToMatch(matches[0], query.length, false);
      }
    },
    [editableCode, scrollToMatch],
  );

  const goToNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    const matchPosition = searchMatches[nextIndex];
    if (matchPosition !== undefined) {
      scrollToMatch(matchPosition, searchQuery.length, false);
    }
  };

  const goToPrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = currentMatchIndex <= 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    const matchPosition = searchMatches[prevIndex];
    if (matchPosition !== undefined) {
      scrollToMatch(matchPosition, searchQuery.length, false);
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    findMatches(query);
  };

  // Replace current match
  const handleReplaceCurrent = useCallback(() => {
    if (searchMatches.length === 0 || currentMatchIndex < 0 || !searchQuery) return;

    const matchPosition = searchMatches[currentMatchIndex];
    if (matchPosition === undefined) return;

    const before = editableCode.substring(0, matchPosition);
    const after = editableCode.substring(matchPosition + searchQuery.length);
    const newCode = before + replaceQuery + after;

    setEditableCode(newCode);
    onCodeChange?.(newCode);

    // Recalculate matches after replacement
    setTimeout(() => {
      findMatches(searchQuery);
    }, 0);
  }, [
    searchMatches,
    currentMatchIndex,
    searchQuery,
    replaceQuery,
    editableCode,
    onCodeChange,
    findMatches,
  ]);

  // Replace all matches
  const handleReplaceAll = useCallback(() => {
    if (searchMatches.length === 0 || !searchQuery) return;

    // Use a case-insensitive global replace
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const newCode = editableCode.replace(regex, replaceQuery);

    setEditableCode(newCode);
    onCodeChange?.(newCode);
    setSearchMatches([]);
    setCurrentMatchIndex(0);
  }, [searchMatches, searchQuery, replaceQuery, editableCode, onCodeChange]);

  // Search from PDF selection - tries to find text from clipboard
  const searchFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const cleanedText = text.trim().replace(/\s+/g, " ").substring(0, 100);
        setShowSearch(true);
        setSearchQuery(cleanedText);
        findMatches(cleanedText);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    } catch {
      // Clipboard access denied - show search bar anyway
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  // Handle double-click on PDF container to search for selected text
  const handlePdfDoubleClick = async () => {
    // Small delay to let browser copy selection
    setTimeout(async () => {
      await searchFromClipboard();
    }, 100);
  };

  // Initial compile when component mounts or code changes significantly
  useEffect(() => {
    if (showPreview && code && !pdfUrl && !isCompiling) {
      compileLatex(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, code]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (compileTimeoutRef.current) {
        clearTimeout(compileTimeoutRef.current);
      }
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegenerate = async () => {
    if (!comment.trim() || !onRegenerate) return;
    await onRegenerate(comment);
    setComment("");
    setShowFeedback(false);
  };

  // Download PDF with single descriptive filename
  const handleDownloadPdf = () => {
    if (pdfUrl) {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = downloadFileName
        ? `${downloadFileName}.pdf`
        : `${title.replace(/\s+/g, "_")}.pdf`;
      link.click();
    }
  };

  // Handle Apply - download PDF and redirect to job URL
  const handleApply = () => {
    // First download the PDF
    handleDownloadPdf();
    // Then call the onApply callback to redirect
    if (onApply) {
      // Small delay to ensure download starts
      setTimeout(() => {
        onApply();
      }, 300);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const renderHighlights = () => {
    if (!editableCode) return null;

    // Default styling that matches the textarea exactly
    // Text is transparent so we only see the background highlights
    // The textarea sits on top with transparent background and visible text

    if (!showSearch || !searchQuery || searchMatches.length === 0) {
      return <>{editableCode + "\n"}</>; // Add newline to ensure height matching
    }

    const elements = [];
    let lastIndex = 0;
    const sortedMatches = [...searchMatches].sort((a, b) => a - b);

    // Dedup matches to avoid overlap issues if any
    const uniqueMatches = sortedMatches.filter((item, pos, ary) => {
      return !pos || item !== ary[pos - 1];
    });

    uniqueMatches.forEach((matchIndex, i) => {
      // Safety check
      if (matchIndex < lastIndex) return;

      // Text before match
      if (matchIndex > lastIndex) {
        elements.push(editableCode.substring(lastIndex, matchIndex));
      }

      // Match
      const isCurrent = i === currentMatchIndex;
      // Use standard Saffron #F4C430. Current match is opaque, others are semi-transparent
      const bgColor = isCurrent ? "#F4C430" : "rgba(244, 196, 48, 0.5)";

      elements.push(
        <span key={`${i}-${matchIndex}`} style={{ backgroundColor: bgColor }}>
          {editableCode.substring(matchIndex, matchIndex + searchQuery.length)}
        </span>,
      );

      lastIndex = matchIndex + searchQuery.length;
    });

    // Remaining text
    if (lastIndex < editableCode.length) {
      elements.push(editableCode.substring(lastIndex));
    }

    // Add trailing newline to match textarea behavior
    elements.push("\n");

    return <>{elements}</>;
  };

  return (
    <div className={`glass-card fade-in flex flex-col ${fullHeight ? "h-full" : ""}`}>
      {/* Header */}
      <div className="border-card-border flex shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Mac-style window controls */}
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
          </div>
          <h3 className="text-foreground/80 truncate text-sm font-medium">{title}</h3>
          {jobUrl && (
            <div className="flex max-w-[200px] items-center gap-2 overflow-hidden sm:max-w-xs">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-primary shrink-0"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <a
                href={jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary truncate text-[11px] font-medium hover:underline"
                title={jobUrl}
              >
                {jobUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </div>
          )}
          {isCompiling && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <span className="spinner-small" />
              Compiling...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          {showPreview && (
            <div className="bg-surface-hover flex gap-0.5 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("code")}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  viewMode === "code" ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
                title="Code only"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("split")}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  viewMode === "split"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
                title="Split view"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  viewMode === "preview"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
                title="Preview only"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <CopyButton text={editableCode} label="Copy" />

          {/* Search Button */}
          <Button
            onClick={() => {
              setShowSearch(!showSearch);
              if (!showSearch) {
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }
            }}
            variant="ghost"
            className="copy-btn"
            title="Find in code (Ctrl+F)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Button>

          {showPreview && pdfUrl && (
            <Button
              onClick={handleDownloadPdf}
              variant="ghost"
              className="copy-btn"
              title="Download PDF"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </Button>
          )}

          {showPreview && (
            <>
              <Button
                onClick={handleManualCompile}
                disabled={isCompiling || !editableCode.trim()}
                variant="ghost"
                className="copy-btn"
                title="Compile LaTeX (Ctrl+S)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span className="hidden sm:inline">Compile</span>
              </Button>
              <button
                onClick={() => setAutoCompile(!autoCompile)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  autoCompile
                    ? "border border-green-300 bg-green-100 text-green-700"
                    : "border border-gray-200 bg-gray-100 text-gray-500"
                }`}
                title={
                  autoCompile
                    ? "Auto-compile ON (click to disable)"
                    : "Auto-compile OFF (click to enable)"
                }
              >
                Auto
              </button>
            </>
          )}

          {onRegenerate && editableCode && (
            <Button
              onClick={() => setShowFeedback(!showFeedback)}
              variant="ghost"
              className="copy-btn"
              title="Regenerate with feedback"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span className="hidden sm:inline">Regenerate</span>
            </Button>
          )}

          {/* Apply Button - Download and Redirect */}
          {onApply && pdfUrl && (
            <Button
              onClick={handleApply}
              variant="success"
              className="text-xs font-medium"
              title="Download resume and apply"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mr-1"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Apply
            </Button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Code Editor */}
        {(viewMode === "code" || viewMode === "split") && (
          <div
            className={`flex flex-col overflow-hidden ${viewMode === "split" ? "border-card-border w-1/2 border-r" : "w-full"}`}
          >
            <div className="relative min-h-0 w-full flex-1">
              {/* Backdrop for Highlights */}
              <div
                ref={backdropRef}
                className="pointer-events-none absolute inset-0 overflow-hidden bg-transparent p-4 font-mono text-sm break-words whitespace-pre-wrap text-transparent"
                aria-hidden="true"
                style={{
                  color: "transparent",
                }}
              >
                {renderHighlights()}
              </div>

              <textarea
                ref={textareaRef}
                value={editableCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setTimeout(() => setIsEditing(false), 100)}
                onScroll={handleScroll}
                className="text-foreground absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-4 font-mono text-sm break-words whitespace-pre-wrap focus:outline-none"
                placeholder="Paste your LaTeX code here... (Ctrl+S to compile)"
                spellCheck={false}
              />
            </div>

            {/* Find Bar - Bottom of code section */}
            {showSearch && (
              <div className="border-card-border bg-surface-hover/50 flex shrink-0 items-center gap-2 border-t px-4 py-2">
                <div className="flex flex-1 items-center gap-1">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
                        e.preventDefault();
                        goToNextMatch();
                      }
                      if (e.key === "Enter" && e.shiftKey) {
                        e.preventDefault();
                        goToPrevMatch();
                      }
                      if (e.key === "Escape") {
                        setShowSearch(false);
                        setShowReplace(false);
                        setSearchQuery("");
                        setReplaceQuery("");
                        setSearchMatches([]);
                      }
                    }}
                    placeholder="Find in code... (Enter for next, Shift+Enter for prev)"
                    className="text-foreground placeholder:text-muted flex-1 bg-transparent text-sm focus:outline-none"
                  />
                </div>
                {searchQuery && (
                  <span className="text-muted text-xs">
                    {searchMatches.length > 0
                      ? `${currentMatchIndex + 1} of ${searchMatches.length}`
                      : "No matches"}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={goToPrevMatch}
                    disabled={searchMatches.length === 0}
                    className="hover:bg-surface-hover rounded p-1 disabled:opacity-40"
                    title="Previous match (Shift+Enter)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    onClick={goToNextMatch}
                    disabled={searchMatches.length === 0}
                    className="hover:bg-surface-hover rounded p-1 disabled:opacity-40"
                    title="Next match (Enter)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setShowReplace(false);
                    setSearchQuery("");
                    setReplaceQuery("");
                    setSearchMatches([]);
                  }}
                  className="hover:bg-surface-hover text-muted hover:text-foreground rounded p-1"
                  title="Close (Esc)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {/* Replace Bar - Bottom of code section */}
            {showSearch && showReplace && (
              <div className="border-card-border bg-surface-hover/50 flex shrink-0 items-center gap-2 border-t px-4 py-2">
                <div className="flex flex-1 items-center gap-1">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  >
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  <input
                    type="text"
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
                        e.preventDefault();
                        handleReplaceCurrent();
                      }
                      if (e.key === "Enter" && e.ctrlKey) {
                        e.preventDefault();
                        handleReplaceAll();
                      }
                      if (e.key === "Escape") {
                        setShowSearch(false);
                        setShowReplace(false);
                        setSearchQuery("");
                        setReplaceQuery("");
                        setSearchMatches([]);
                      }
                    }}
                    placeholder="Replace with... (Enter to replace, Ctrl+Enter to replace all)"
                    className="text-foreground placeholder:text-muted flex-1 bg-transparent text-sm focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleReplaceCurrent}
                    disabled={searchMatches.length === 0}
                    className="hover:bg-surface-hover border-card-border rounded border px-2 py-1 text-xs disabled:opacity-40"
                    title="Replace current match (Enter)"
                  >
                    Replace
                  </button>
                  <button
                    onClick={handleReplaceAll}
                    disabled={searchMatches.length === 0}
                    className="hover:bg-surface-hover border-card-border rounded border px-2 py-1 text-xs disabled:opacity-40"
                    title="Replace all matches (Ctrl+Enter)"
                  >
                    Replace All
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF Preview */}
        {showPreview && (viewMode === "preview" || viewMode === "split") && (
          <div
            ref={pdfContainerRef}
            className={`flex flex-col overflow-auto bg-gray-100 ${viewMode === "split" ? "w-1/2" : "w-full"} group relative`}
          >
            <Suspense
              fallback={
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                  <span className="spinner mb-4" />
                  <p className="text-muted text-sm">Loading preview...</p>
                </div>
              }
            >
              <PDFPreview
                pdfBase64={pdfBase64}
                compileError={compileError}
                isCompiling={isCompiling}
                onRetry={handleManualCompile}
                onDoubleClick={handlePdfDoubleClick}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {/* Status Bar - only show when not in full height mode */}
      {showPreview && !fullHeight && (
        <div className="border-card-border bg-surface-hover/50 text-muted flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs">
          <span>
            {isCompiling
              ? "Compiling..."
              : compileError
                ? "Error"
                : pdfBase64
                  ? "✓ Compiled"
                  : "Ready"}
          </span>
          <span className="text-muted-light">
            {autoCompile ? "Auto-compile: ON" : "Press Ctrl+S to compile"}
          </span>
        </div>
      )}

      {/* Regenerate Feedback Section */}
      {showFeedback && onRegenerate && (
        <div className="regenerate-section fade-in shrink-0">
          <label className="text-muted mb-2 block text-xs font-medium">
            What changes would you like?
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g., Make the summary more concise, add more keywords..."
            className="regenerate-input mb-3"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setShowFeedback(false);
                setComment("");
              }}
              variant="secondary"
              className="px-3 py-2 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={!comment.trim() || isRegenerating}
              variant="regenerate"
            >
              {isRegenerating ? (
                <>
                  <span className="spinner-small" />
                  Regenerating...
                </>
              ) : (
                "Apply Changes"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
