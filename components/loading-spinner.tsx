interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
      <div className="relative w-8 h-8">
        <svg
          className="animate-spin"
          viewBox="0 0 50 50"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="text-blue-600 dark:text-blue-400" stopOpacity="0" style={{ stopColor: 'currentColor' }} />
              <stop offset="100%" className="text-blue-600 dark:text-blue-400" stopOpacity="1" style={{ stopColor: 'currentColor' }} />
            </linearGradient>
          </defs>
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="url(#spinnerGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="90 150"
          />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
