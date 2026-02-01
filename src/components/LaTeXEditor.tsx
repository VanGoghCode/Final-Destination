"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import CopyButton from "./CopyButton";
import Button from "./Button";

interface LaTeXEditorProps {
  code: string;
  title: string;
  onCodeChange?: (code: string) => void;
  onRegenerate?: (comment: string) => Promise<void>;
  isRegenerating?: boolean;
  showPreview?: boolean;
  fullHeight?: boolean;
  downloadFileNames?: [string, string]; // [plainName, detailedName]
}

export default function LaTeXEditor({
  code,
  title,
  onCodeChange,
  onRegenerate,
  isRegenerating = false,
  showPreview = true,
  fullHeight = false,
  downloadFileNames,
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
  const compileTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Sync with external code changes
  useEffect(() => {
    if (!isEditing) {
      setEditableCode(code);
    }
  }, [code, isEditing]);

  // Compile LaTeX to PDF
  const compileLatex = useCallback(async (latexCode: string) => {
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
  }, [pdfUrl]);

  // Debounced compilation on code change (only when auto-compile is enabled)
  const handleCodeChange = useCallback((newCode: string) => {
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
  }, [compileLatex, onCodeChange, autoCompile]);

  // Handle CTRL+S to compile, CTRL+F to search
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (e.key === "Escape" && showSearch) {
      setShowSearch(false);
      setSearchQuery("");
      setSearchMatches([]);
    }
  }, [compileLatex, editableCode, showSearch]);

  // Manual compile button
  const handleManualCompile = () => {
    if (compileTimeoutRef.current) {
      clearTimeout(compileTimeoutRef.current);
    }
    compileLatex(editableCode);
  };

  // Search functions
  const findMatches = useCallback((query: string) => {
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
    if (matches.length > 0) {
      scrollToMatch(matches[0], query.length);
    }
  }, [editableCode]);

  const scrollToMatch = (position: number, length: number) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.focus();
    textarea.setSelectionRange(position, position + length);
    // Calculate scroll position
    const textBeforeMatch = editableCode.substring(0, position);
    const linesBefore = textBeforeMatch.split("\n").length - 1;
    const lineHeight = 20; // approximate line height
    const scrollTop = Math.max(0, linesBefore * lineHeight - 100);
    textarea.scrollTop = scrollTop;
  };

  const goToNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(searchMatches[nextIndex], searchQuery.length);
  };

  const goToPrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = currentMatchIndex <= 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(searchMatches[prevIndex], searchQuery.length);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    findMatches(query);
  };

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
  }, []);

  const handleRegenerate = async () => {
    if (!comment.trim() || !onRegenerate) return;
    await onRegenerate(comment);
    setComment("");
    setShowFeedback(false);
  };

  // Download PDF - downloads twice with both filenames
  const handleDownloadPdf = () => {
    if (pdfUrl) {
      const download = (filename: string) => {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `${filename}.pdf`;
        link.click();
      };
      
      if (downloadFileNames && downloadFileNames.length === 2) {
        // Download with plain filename first
        download(downloadFileNames[0]);
        // Small delay before second download
        setTimeout(() => {
          download(downloadFileNames[1]);
        }, 500);
      } else {
        // Fallback to title-based filename
        download(title.replace(/\s+/g, "_"));
      }
    }
  };

  return (
    <div className={`glass-card fade-in flex flex-col ${fullHeight ? "h-full" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-card-border shrink-0">
        <div className="flex items-center gap-3">
          {/* Mac-style window controls */}
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          </div>
          <h3 className="text-sm font-medium text-foreground/80 truncate">
            {title}
          </h3>
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
            <div className="flex bg-surface-hover rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode("code")}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === "code"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
                title="Code only"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("split")}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === "split"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
                title="Split view"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === "preview"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
                title="Preview only"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span className="hidden sm:inline">Compile</span>
              </Button>
              <button
                onClick={() => setAutoCompile(!autoCompile)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  autoCompile
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : "bg-gray-100 text-gray-500 border border-gray-200"
                }`}
                title={autoCompile ? "Auto-compile ON (click to disable)" : "Auto-compile OFF (click to enable)"}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span className="hidden sm:inline">Regenerate</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-card-border bg-surface-hover/50 shrink-0">
          <div className="flex items-center gap-1 flex-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.shiftKey ? goToPrevMatch() : goToNextMatch();
                }
                if (e.key === "Escape") {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchMatches([]);
                }
              }}
              placeholder="Find in code... (Enter for next, Shift+Enter for prev)"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            />
          </div>
          {searchQuery && (
            <span className="text-xs text-muted">
              {searchMatches.length > 0 ? `${currentMatchIndex + 1} of ${searchMatches.length}` : "No matches"}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevMatch}
              disabled={searchMatches.length === 0}
              className="p-1 rounded hover:bg-surface-hover disabled:opacity-40"
              title="Previous match (Shift+Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button
              onClick={goToNextMatch}
              disabled={searchMatches.length === 0}
              className="p-1 rounded hover:bg-surface-hover disabled:opacity-40"
              title="Next match (Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
              setSearchMatches([]);
            }}
            className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Code Editor */}
        {(viewMode === "code" || viewMode === "split") && (
          <div className={`flex flex-col overflow-hidden ${viewMode === "split" ? "w-1/2 border-r border-card-border" : "w-full"}`}>
            <textarea
              ref={textareaRef}
              value={editableCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsEditing(true)}
              onBlur={() => setTimeout(() => setIsEditing(false), 100)}
              className="flex-1 p-4 bg-transparent text-sm font-mono text-foreground resize-none focus:outline-none overflow-auto w-full h-full"
              placeholder="Paste your LaTeX code here... (Ctrl+S to compile)"
              spellCheck={false}
            />
          </div>
        )}

        {/* PDF Preview */}
        {showPreview && (viewMode === "preview" || viewMode === "split") && (
          <div 
            ref={pdfContainerRef}
            className={`flex flex-col bg-gray-100 overflow-auto ${viewMode === "split" ? "w-1/2" : "w-full"} relative group`}
            onDoubleClick={handlePdfDoubleClick}
            title="Tip: Select text in PDF, copy it (Ctrl+C), then double-click here to find it in the code"
          >
            {compileError ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" className="mb-4">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-sm font-medium text-red-600 mb-2">Compilation Error</p>
                <p className="text-xs text-red-500 max-w-xs font-mono whitespace-pre-wrap">{compileError}</p>
                <Button
                  onClick={handleManualCompile}
                  variant="secondary"
                  className="mt-4 text-xs"
                >
                  Retry Compilation
                </Button>
              </div>
            ) : pdfBase64 ? (
              // PDF container
              <div className="flex-1 overflow-auto flex justify-center">
                <object
                  data={`data:application/pdf;base64,${pdfBase64}#toolbar=0&navpanes=0`}
                  type="application/pdf"
                  className="w-full h-full border-0"
                  title="PDF Preview"
                >
                  {/* Fallback for browsers that don't support object */}
                  <iframe
                    src={`data:application/pdf;base64,${pdfBase64}#toolbar=0&navpanes=0`}
                    className="w-full h-full border-0"
                    title="PDF Preview"
                  />
                </object>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                {isCompiling ? (
                  <>
                    <span className="spinner mb-4" />
                    <p className="text-sm text-muted">Compiling LaTeX...</p>
                  </>
                ) : (
                  <>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted mb-4">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p className="text-sm text-muted mb-2">No preview available</p>
                    <p className="text-xs text-muted-light">Enter LaTeX code and click Compile</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      {/* Status Bar - only show when not in full height mode */}
      {showPreview && !fullHeight && (
        <div className="px-4 py-2 border-t border-card-border bg-surface-hover/50 flex items-center justify-between text-xs text-muted shrink-0">
          <span>
            {isCompiling ? "Compiling..." : compileError ? "Error" : pdfBase64 ? "✓ Compiled" : "Ready"}
          </span>
          <span className="text-muted-light">
            {autoCompile ? "Auto-compile: ON" : "Press Ctrl+S to compile"}
          </span>
        </div>
      )}

      {/* Regenerate Feedback Section */}
      {showFeedback && onRegenerate && (
        <div className="regenerate-section fade-in shrink-0">
          <label className="text-xs font-medium text-muted mb-2 block">
            What changes would you like?
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g., Make the summary more concise, add more keywords..."
            className="regenerate-input mb-3"
            rows={2}
          />
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => {
                setShowFeedback(false);
                setComment("");
              }}
              variant="secondary"
              className="text-xs py-2 px-3"
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
