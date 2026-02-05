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
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Calculate segment widths
  const completedWidth = total > 0 ? (completed / total) * 100 : 0;
  const failedWidth = total > 0 ? (failed / total) * 100 : 0;
  const inProgressWidth = total > 0 ? (inProgress / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="text-center py-8 text-muted">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-sm">No jobs in queue</p>
        <p className="text-xs mt-1">Add jobs to start batch processing</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {isProcessing ? "Processing..." : completed === total ? "All Complete!" : "Queue Status"}
          </span>
          <span className="text-sm text-muted">{completed}/{total} jobs</span>
        </div>
        
        {/* Segmented progress bar */}
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
          {/* Completed segment */}
          <div 
            className="h-full bg-linear-to-r from-green-400 to-green-500 transition-all duration-500"
            style={{ width: `${completedWidth}%` }}
          />
          {/* In progress segment */}
          <div 
            className="h-full bg-linear-to-r from-blue-400 to-purple-500 transition-all duration-500 relative overflow-hidden"
            style={{ width: `${inProgressWidth}%` }}
          >
            {/* Animated shimmer */}
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
          {/* Failed segment */}
          <div 
            className="h-full bg-linear-to-r from-red-400 to-red-500 transition-all duration-500"
            style={{ width: `${failedWidth}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Pending" value={pending} color="gray" icon="clock" />
        <StatCard label="Processing" value={inProgress} color="blue" icon="spinner" spinning={isProcessing} />
        <StatCard label="Completed" value={completed} color="green" icon="check" />
        <StatCard label="Failed" value={failed} color="red" icon="x" />
      </div>

      {/* Success rate */}
      {completed > 0 && (
        <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100">
          <div className={`w-2 h-2 rounded-full ${successRate >= 80 ? 'bg-green-500' : successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
          <span className="text-xs text-muted">
            Success rate: <span className="font-medium text-foreground">{successRate}%</span>
          </span>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: "gray" | "blue" | "green" | "red";
  icon: "clock" | "spinner" | "check" | "x";
  spinning?: boolean;
}

function StatCard({ label, value, color, icon, spinning }: StatCardProps) {
  const colorClasses = {
    gray: "bg-gray-50 text-gray-600 border-gray-200",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    red: "bg-red-50 text-red-600 border-red-200",
  };

  const icons = {
    clock: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeWidth="2" d="M12 6v6l4 2" />
      </svg>
    ),
    spinner: (
      <svg className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    check: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    x: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  };

  return (
    <div className={`px-3 py-2 rounded-lg border ${colorClasses[color]} text-center`}>
      <div className="flex items-center justify-center gap-1.5 mb-0.5">
        {icons[icon]}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
    </div>
  );
}
