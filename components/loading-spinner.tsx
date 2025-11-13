import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
