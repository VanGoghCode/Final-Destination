"use client";

interface QueueProgressProps {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  isProcessing: boolean;
}

export default function QueueProgress({ total, completed, failed, pending, isProcessing }: QueueProgressProps) {
  const inProgress = total - completed - failed - pending;
  
  // Calculate segment widths
  const completedWidth = total > 0 ? (completed / total) * 100 : 0;
  const failedWidth = total > 0 ? (failed / total) * 100 : 0;
  const inProgressWidth = total > 0 ? (inProgress / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="text-center py-4 text-muted">
        <p className="text-xs">No jobs in queue</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Overall progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-700">
            {isProcessing ? "Processing..." : completed === total ? "Complete" : "Queue"}
          </span>
          <span className="text-xs text-gray-500">{completed}/{total}</span>
        </div>
        
        {/* Segmented progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
          {/* Completed segment */}
          <div 
            className="h-full bg-gray-600 transition-all duration-500"
            style={{ width: `${completedWidth}%` }}
          />
          {/* In progress segment */}
          <div 
            className="h-full bg-gray-400 transition-all duration-500"
            style={{ width: `${inProgressWidth}%` }}
          />
          {/* Failed segment */}
          <div 
            className="h-full bg-gray-300 transition-all duration-500"
            style={{ width: `${failedWidth}%` }}
          />
        </div>
      </div>

      {/* Compact stats */}
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{pending} pending</span>
        <span>{inProgress} active</span>
        <span>{completed} done</span>
        {failed > 0 && <span>{failed} failed</span>}
      </div>
    </div>
  );
}
