"use client";

import { useState, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import type { AIProvider } from "@/lib/ai-providers/types";

interface ProviderToggleProps {
  label: string;
  value: AIProvider;
  onChange: (value: AIProvider) => void;
  disabled?: boolean;
}

function ProviderToggle({
  label,
  value,
  onChange,
  disabled = false,
}: ProviderToggleProps) {
  const handleToggle = () => {
    if (disabled) return;
    const newValue: AIProvider = value === "gemini" ? "claude" : "gemini";
    onChange(newValue);
  };

  return (
    <div className={`provider-toggle ${disabled ? "disabled" : ""}`}>
      <span className="provider-toggle__label">{label}</span>
      <button
        onClick={handleToggle}
        className="provider-toggle__switch"
        role="switch"
        aria-checked={value === "claude"}
        title={
          disabled
            ? "Access restricted"
            : `Using ${value === "gemini" ? "Gemini" : "Claude"}`
        }
        disabled={disabled}
      >
        <span
          className={`provider-toggle__option ${value === "gemini" ? "active" : ""}`}
        >
          Gemini
        </span>
        <span
          className={`provider-toggle__option ${value === "claude" ? "active" : ""}`}
        >
          Claude
        </span>
        <div
          className="provider-toggle__slider"
          style={{
            transform:
              value === "claude" ? "translateX(100%)" : "translateX(0)",
          }}
        />
      </button>

      <style jsx>{`
        .provider-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .provider-toggle.disabled {
          opacity: 0.6;
        }

        .provider-toggle__label {
          font-size: 11px;
          font-weight: 500;
          color: #6b7280;
        }

        .provider-toggle__switch {
          position: relative;
          display: flex;
          background: #f3f4f6;
          border-radius: 6px;
          padding: 2px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .provider-toggle.disabled .provider-toggle__switch {
          cursor: not-allowed;
        }

        .provider-toggle__switch:hover:not(:disabled) {
          border-color: #d1d5db;
        }

        .provider-toggle__option {
          position: relative;
          z-index: 1;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          border-radius: 4px;
          transition: color 0.2s ease;
          white-space: nowrap;
        }

        .provider-toggle__option.active {
          color: #111827;
        }

        .provider-toggle__slider {
          position: absolute;
          top: 2px;
          left: 2px;
          width: calc(50% - 2px);
          height: calc(100% - 4px);
          background: white;
          border-radius: 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}

export default function ModelSelector() {
  const {
    researchProvider,
    tailoringProvider,
    setResearchProvider,
    setTailoringProvider,
  } = useAppContext();

  const [isUnlocked, setIsUnlocked] = useState(false);

  // Check for unlock code in localStorage
  useEffect(() => {
    const unlocked = localStorage.getItem("model_selector_unlocked") === "true";
    setIsUnlocked(unlocked);

    // If locked, force Gemini
    if (!unlocked) {
      if (researchProvider !== "gemini") setResearchProvider("gemini");
      if (tailoringProvider !== "gemini") setTailoringProvider("gemini");
    }
  }, [
    researchProvider,
    tailoringProvider,
    setResearchProvider,
    setTailoringProvider,
  ]);

  const handleUnlock = () => {
    const code = window.prompt("Enter code to unlock model selection:");
    if (code === "26012002") {
      localStorage.setItem("model_selector_unlocked", "true");
      setIsUnlocked(true);
      alert("Model selection unlocked!");
    } else if (code !== null) {
      alert("Invalid code");
    }
  };

  return (
    <div className="model-selector">
      <div className="model-selector__header">
        <span className="model-selector__title">AI Models</span>
        {!isUnlocked && (
          <button
            onClick={handleUnlock}
            className="model-selector__unlock-btn"
            title="Unlock settings"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
        )}
      </div>

      <ProviderToggle
        label="Research"
        value={researchProvider}
        onChange={setResearchProvider}
        disabled={!isUnlocked}
      />
      <ProviderToggle
        label="Tailoring"
        value={tailoringProvider}
        onChange={setTailoringProvider}
        disabled={!isUnlocked}
      />

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

        .model-selector__unlock-btn {
          cursor: pointer;
          color: #d1d5db;
          padding: 2px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .model-selector__unlock-btn:hover {
          color: #6b7280;
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
}
