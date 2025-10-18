export interface PasswordRequirement {
  label: string
  met: boolean
}

export interface PasswordStrength {
  score: number // 0-4
  label: string
  color: string
  requirements: PasswordRequirement[]
}

export function validatePassword(password: string): PasswordStrength {
  const requirements: PasswordRequirement[] = [
    {
      label: "At least 12 characters",
      met: password.length >= 12,
    },
    {
      label: "One uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "One lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      label: "One number",
      met: /[0-9]/.test(password),
    },
    {
      label: "One special character (!@#$%^&*)",
      met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    },
  ]

  const metCount = requirements.filter((r) => r.met).length

  let score = 0
  let label = "Very Weak"
  let color = "bg-red-500"

  if (metCount === 5) {
    score = 4
    label = "Strong"
    color = "bg-green-500"
  } else if (metCount === 4) {
    score = 3
    label = "Good"
    color = "bg-yellow-500"
  } else if (metCount === 3) {
    score = 2
    label = "Fair"
    color = "bg-orange-500"
  } else if (metCount >= 1) {
    score = 1
    label = "Weak"
    color = "bg-red-400"
  }

  return {
    score,
    label,
    color,
    requirements,
  }
}

export function isPasswordValid(password: string): boolean {
  const strength = validatePassword(password)
  return strength.requirements.every((r) => r.met)
}
