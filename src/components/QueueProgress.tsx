"use client";

interface QueueProgressProps {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  cancelled: number;
  isProcessing: boolean;
}

export default function QueueProgress({
  total,
  completed,
  failed,
  pending,
  cancelled,
  isProcessing,
}: QueueProgressProps) {
  const inProgress = total - completed - failed - pending - cancelled;

  if (total === 0) {
    return (
      <div className="text-muted py-4 text-center">
        <p className="text-xs">No jobs in queue</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Overall progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">
            {isProcessing ? "Processing..." : completed === total ? "Complete" : "Queue"}
          </span>
          <span className="text-xs text-gray-500">
            {completed}/{total}
          </span>
        </div>

        {/* Segmented progress bar */}
        <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
          {[
            { count: completed, color: "bg-gray-600" },
            { count: inProgress, color: "bg-gray-400" },
            { count: failed, color: "bg-gray-300" },
          ].map(({ count, color }) => (
            <div
              key={color}
              className={`h-full ${color} transition-all duration-500`}
              style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
            />
          ))}
        </div>
      </div>

      {/* Compact stats */}
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{pending} pending</span>
        <span>{inProgress} active</span>
        <span>{completed} done</span>
        {failed > 0 && <span>{failed} failed</span>}
        {cancelled > 0 && <span>{cancelled} cancelled</span>}
      </div>
    </div>
  );
}
