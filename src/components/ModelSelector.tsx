"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "fd_deepseek_api_key";
const COOKIE_NAME = "fd_api_key";

function setCookie(value: string) {
  // Set cookie with 1 year expiry. Lax (not Strict) so it's sent on top-level
  // navigations from other sites. Secure required for Vercel HTTPS.
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax;Secure`;
}

function clearCookie() {
  document.cookie = `${COOKIE_NAME}=;path=/;max-age=0`;
}

export default function ModelSelector() {
  const [hasKey, setHasKey] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(STORAGE_KEY);
  });
  const [showModal, setShowModal] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer to next tick to avoid synchronous setState in effect
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) return;

    setSaving(true);
    localStorage.setItem(STORAGE_KEY, trimmed);
    setCookie(trimmed);
    setHasKey(true);
    setInputKey("");
    setSaving(false);
    setShowModal(false);
  };

  const handleRemove = () => {
    localStorage.removeItem(STORAGE_KEY);
    clearCookie();
    setHasKey(false);
    setInputKey("");
    setShowModal(false);
  };

  const handleOpen = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setInputKey(stored || "");
    setShowModal(true);
  };

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="model-selector">
        <div className="model-selector__header">
          <span className="model-selector__title">AI Model</span>
        </div>
        <div className="model-selector__info">
          <span className="model-selector__provider">DeepSeek V4 Flash</span>
        </div>
        <style jsx>{`
          .model-selector {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
          }
          .model-selector__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .model-selector__title {
            font-size: 10px;
            font-weight: 700;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .model-selector__info {
            padding: 6px 10px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          }
          .model-selector__provider {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className="model-selector">
        <div className="model-selector__header">
          <span className="model-selector__title">AI Model</span>
          <span className={`model-selector__indicator ${hasKey ? "active" : "inactive"}`} />
        </div>

        <button
          type="button"
          className={`model-selector__info ${hasKey ? "clickable" : "clickable-warn"}`}
          onClick={handleOpen}
          title={hasKey ? "Click to replace API key" : "Click to add API key"}
        >
          <span className="model-selector__provider">DeepSeek V4 Flash</span>
          <span className={`model-selector__status ${hasKey ? "active" : "inactive"}`}>
            {hasKey ? "Key configured" : "No API key"}
          </span>
        </button>
      </div>

      {showModal &&
        createPortal(
          <div className="model-selector__overlay" onClick={() => setShowModal(false)}>
            <div className="model-selector__modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="model-selector__modal-title">DeepSeek API Key</h3>
              <p className="model-selector__modal-desc">
                Enter your DeepSeek API key. Get one at{" "}
                <a href="https://api.deepseek.com" target="_blank" rel="noopener noreferrer">
                  api.deepseek.com
                </a>
                . Your key is stored locally in your browser and never sent to our servers.
              </p>

              <input
                type="password"
                className="model-selector__input"
                placeholder="sk-your-api-key"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />

              <div className="model-selector__actions">
                {hasKey && (
                  <button
                    type="button"
                    className="model-selector__btn model-selector__btn--danger"
                    onClick={handleRemove}
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  className="model-selector__btn model-selector__btn--secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="model-selector__btn model-selector__btn--primary"
                  onClick={handleSave}
                  disabled={!inputKey.trim() || saving}
                >
                  {saving ? "Saving..." : hasKey ? "Update" : "Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx>{`
        .model-selector {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }
        .model-selector__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .model-selector__title {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .model-selector__indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .model-selector__indicator.active {
          background: #22c55e;
          box-shadow: 0 0 4px rgba(34, 197, 94, 0.4);
        }
        .model-selector__indicator.inactive {
          background: #ef4444;
          box-shadow: 0 0 4px rgba(239, 68, 68, 0.4);
        }
        .model-selector__info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          width: 100%;
          font: inherit;
          cursor: pointer;
        }
        .model-selector__info.clickable:hover {
          border-color: #d1d5db;
          background: #f3f4f6;
        }
        .model-selector__info.clickable-warn:hover {
          border-color: #fca5a5;
          background: #fef2f2;
        }
        .model-selector__provider {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
        }
        .model-selector__status {
          font-size: 10px;
          font-weight: 500;
        }
        .model-selector__status.active {
          color: #16a34a;
        }
        .model-selector__status.inactive {
          color: #dc2626;
        }

        /* Modal */
        .model-selector__overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(2px);
        }
        .model-selector__modal {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          width: 400px;
          max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }
        .model-selector__modal-title {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }
        .model-selector__modal-desc {
          font-size: 12px;
          color: #6b7280;
          margin: 0 0 16px;
          line-height: 1.5;
        }
        .model-selector__modal-desc a {
          color: #2563eb;
          text-decoration: underline;
        }
        .model-selector__input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 13px;
          font-family: monospace;
          outline: none;
          transition: border-color 0.15s;
          color: #111827;
          background: #f9fafb;
        }
        .model-selector__input:focus {
          border-color: #6b7280;
          background: white;
        }
        .model-selector__input::placeholder {
          color: #9ca3af;
        }
        .model-selector__actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 16px;
        }
        .model-selector__btn {
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s;
        }
        .model-selector__btn--primary {
          background: #111827;
          color: white;
        }
        .model-selector__btn--primary:hover:not(:disabled) {
          background: #1f2937;
        }
        .model-selector__btn--primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .model-selector__btn--secondary {
          background: white;
          color: #374151;
          border-color: #d1d5db;
        }
        .model-selector__btn--secondary:hover {
          background: #f9fafb;
        }
        .model-selector__btn--danger {
          background: white;
          color: #dc2626;
          border-color: #fca5a5;
          margin-right: auto;
        }
        .model-selector__btn--danger:hover {
          background: #fef2f2;
        }
      `}</style>
    </>
  );
}
