interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4">
      <div className="relative w-6 h-6">
        <svg className="animate-spin" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            className="text-gray-900"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="90 150"
          />
        </svg>
      </div>
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  )
}
