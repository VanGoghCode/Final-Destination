"use client";
import { useRef, useState } from "react";
import { exportWorkspace, restoreWorkspace } from "@/lib/workspace-backup";

export default function WorkspaceControls() {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const report = (error: unknown) =>
    setError(error instanceof Error ? error.message : "Backup failed");
  return (
    <div className="mt-3 space-y-2 text-xs">
      <div className="flex gap-2">
        <button
          title="Export the shared queue without API keys"
          className="flex-1 rounded-lg border px-2 py-2 hover:bg-gray-50"
          onClick={async () => {
            try {
              const url = URL.createObjectURL(
                new Blob([await exportWorkspace()], { type: "application/json" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "user-data-final-destination.json";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setError("");
            } catch (error) {
              report(error);
            }
          }}
        >
          Export backup
        </button>
        <button
          title="Restore the shared queue from a backup"
          className="flex-1 rounded-lg border px-2 py-2 hover:bg-gray-50"
          onClick={() => file.current?.click()}
        >
          Restore backup
        </button>
      </div>
      <input
        ref={file}
        className="hidden"
        type="file"
        accept="application/json,.json"
        aria-label="Workspace backup"
        onChange={async (event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (
            !selected ||
            !window.confirm("Replace the shared queue in every browser with this backup?")
          )
            return;
          try {
            await restoreWorkspace(await selected.text());
            window.location.reload();
          } catch (error) {
            report(error);
          }
        }}
      />
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
