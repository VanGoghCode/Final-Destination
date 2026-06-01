"use client";

// ModelSelector simplified — only DeepSeek V4 Flash is active.
// Gemini and Claude removed per migration (2026-06-01).
// The component remains as a placeholder in case multi-provider
// support is restored in the future.

export default function ModelSelector() {
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
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
        }

        .model-selector__provider {
          font-size: 12px;
          font-weight: 600;
          color: #166534;
        }
      `}</style>
    </div>
  );
}
