"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { User, Users } from "lucide-react"

interface UserProfile {
  id: string
  username: string
  display_name: string
  type: "user"
}

interface Group {
  id: string
  name: string
  description: string | null
  type: "group"
}

type SearchResult = UserProfile | Group

interface UserGroupAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (item: SearchResult) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  groupsOnly?: boolean
}

export default function UserGroupAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter username or group name...",
  label = "Add Participants",
  disabled = false,
  groupsOnly = false,
}: UserGroupAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const searchUsersAndGroups = async () => {
      if (!value || value.length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setIsLoading(true)
      try {
        const supabase = createClient()

        let userResults: UserProfile[] = []
        if (!groupsOnly) {
          const {
            data: { user },
          } = await supabase.auth.getUser()

          const { data: users, error: usersError } = await supabase
            .from("profiles")
            .select("id, username, display_name")
            .or(`username.ilike.%${value}%,display_name.ilike.%${value}%`)
            .neq("id", user?.id || "")
            .limit(3)

          if (usersError) {
            console.error("Error searching users:", usersError)
          }

          userResults = (users || []).map((user) => ({
            ...user,
            type: "user" as const,
          }))
        }

        const { data: groups, error: groupsError } = await supabase
          .from("groups")
          .select("id, name, description")
          .or(`name.ilike.%${value}%,description.ilike.%${value}%`)
          .limit(3)

        if (groupsError) {
          console.error("Error searching groups:", groupsError)
        }

        const groupResults: Group[] = (groups || []).map((group) => ({
          ...group,
          type: "group" as const,
        }))

        const allResults = [...userResults, ...groupResults]
        setSuggestions(allResults)
        setShowSuggestions(true)
        setSelectedIndex(-1)
      } catch (error) {
        console.error("Error searching users and groups:", error)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchUsersAndGroups, 300)
    return () => clearTimeout(debounceTimer)
  }, [value, groupsOnly])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const handleSelect = (item: SearchResult) => {
    onChange(item.type === "user" ? item.username : item.name)
    onSelect?.(item)
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
          handleSelect(suggestions[selectedIndex])
        }
        break
      case "Escape":
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    }, 150)
  }

  return (
    <div className="relative space-y-2">
      <Label htmlFor="user-group-autocomplete">{label}</Label>
      <Input
        ref={inputRef}
        id="user-group-autocomplete"
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
            <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
          ) : suggestions.length > 0 ? (
            <div ref={suggestionsRef} className="py-1">
              {suggestions.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-accent ${
                    index === selectedIndex ? "bg-accent" : ""
                  }`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {item.type === "user" ? (
                    <User className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Users className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.type === "user" ? item.username : item.name}</div>
                    {item.type === "user" && item.display_name && item.display_name !== item.username && (
                      <div className="text-xs text-muted-foreground">{item.display_name}</div>
                    )}
                    {item.type === "group" && item.description && (
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    )}
                    <div className="text-xs text-blue-600 font-medium">{item.type === "user" ? "User" : "Group"}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : value.length >= 2 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No {groupsOnly ? "groups" : "users or groups"} found matching "{value}"
            </div>
          ) : null}
        </Card>
      )}
    </div>
  )
}
