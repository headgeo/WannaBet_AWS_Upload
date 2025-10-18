"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Users } from "lucide-react"
import { searchGroups } from "@/app/actions/groups"

interface Group {
  id: string
  name: string
  description: string | null
  creator_id: string
  created_at: string
  profiles?: {
    username: string
    display_name: string | null
  }
}

interface GroupAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onGroupSelect?: (group: Group) => void
  placeholder?: string
  label?: string
  disabled?: boolean
}

export default function GroupAutocomplete({
  value,
  onChange,
  onGroupSelect,
  placeholder = "Search for groups...",
  label = "Group Name",
  disabled = false,
}: GroupAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const performSearch = async () => {
      if (!value || value.length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setIsLoading(true)
      try {
        const result = await searchGroups(value)

        if (result.success) {
          setSuggestions(result.groups || [])
          setShowSuggestions(true)
          setSelectedIndex(-1)
        } else {
          console.error("Error searching groups:", result.error)
          setSuggestions([])
        }
      } catch (error) {
        console.error("Error searching groups:", error)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(performSearch, 300)
    return () => clearTimeout(debounceTimer)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const handleGroupSelect = (group: Group) => {
    onChange(group.name)
    onGroupSelect?.(group)
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleGroupSelect(suggestions[selectedIndex])
        }
        break
      case "Escape":
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    }, 150)
  }

  return (
    <div className="relative space-y-2">
      <Label htmlFor="group-autocomplete">{label}</Label>
      <Input
        ref={inputRef}
        id="group-autocomplete"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => value.length >= 2 && setShowSuggestions(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />

      {showSuggestions && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto border shadow-lg bg-background">
          {isLoading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">Searching groups...</div>
          ) : suggestions.length > 0 ? (
            <div ref={suggestionsRef} className="py-1">
              {suggestions.map((group, index) => (
                <div
                  key={group.id}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-accent ${
                    index === selectedIndex ? "bg-accent" : ""
                  }`}
                  onClick={() => handleGroupSelect(group)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{group.name}</div>
                    {group.description && (
                      <div className="text-xs text-muted-foreground truncate">{group.description}</div>
                    )}
                    {group.profiles && (
                      <div className="text-xs text-muted-foreground">
                        Created by {group.profiles.display_name || group.profiles.username}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : value.length >= 2 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">No groups found matching "{value}"</div>
          ) : null}
        </Card>
      )}
    </div>
  )
}
