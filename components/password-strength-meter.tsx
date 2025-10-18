"use client"

import { validatePassword } from "@/lib/utils/password-validation"
import { Check, X } from "lucide-react"

interface PasswordStrengthMeterProps {
  password: string
  showRequirements?: boolean
}

export function PasswordStrengthMeter({ password, showRequirements = true }: PasswordStrengthMeterProps) {
  const strength = validatePassword(password)

  if (!password) return null

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Password strength:</span>
          <span className="font-medium">{strength.label}</span>
        </div>
        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i < strength.score ? strength.color : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Requirements List */}
      {showRequirements && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Password must contain:</p>
          <ul className="space-y-1.5">
            {strength.requirements.map((req, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                {req.met ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={req.met ? "text-foreground" : "text-muted-foreground"}>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
