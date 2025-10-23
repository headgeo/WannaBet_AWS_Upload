"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Users, Plus, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import GroupAutocomplete from "./group-autocomplete"
import { createGroup, joinGroup, leaveGroup, getUserGroups } from "@/app/actions/groups"

interface Group {
  id: string
  name: string
  description: string | null
  creator_id: string
  created_at: string
  joined_at?: string
  profiles?: {
    username: string
    display_name: string | null
  }
}

interface UserGroup {
  id: string
  joined_at: string
  groups: {
    id: string
    name: string
    description: string | null
    creator_id: string
    created_at: string
    profiles?: {
      username: string
      display_name: string | null
    } | null
  } | null
}

interface GroupsSectionProps {
  userId: string
}

export default function GroupsSection({ userId }: GroupsSectionProps) {
  const [userGroups, setUserGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDescription, setNewGroupDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    loadUserGroups()
  }, [userId])

  const loadUserGroups = async () => {
    try {
      console.log("[v0] Loading groups for user:", userId)
      const result = await getUserGroups(userId)
      console.log("[v0] getUserGroups result:", result)

      if (result.success) {
        console.log("[v0] Raw groups data:", result.groups)
        const groups: Group[] =
          (result.groups
            ?.map((userGroup: UserGroup) => {
              if (!userGroup.groups) return null
              return {
                ...userGroup.groups,
                joined_at: userGroup.joined_at,
              }
            })
            .filter(Boolean) as Group[]) || []

        console.log("[v0] Processed groups:", groups)
        setUserGroups(groups)
      } else {
        console.error("Error loading user groups:", result.error)
        toast({
          title: "Error",
          description: "Failed to load your groups",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading user groups:", error)
      toast({
        title: "Error",
        description: "Failed to load your groups",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinGroup = async (group: Group) => {
    setIsJoining(true)
    try {
      const result = await joinGroup(group.id)

      if (result.success) {
        // Add to local state
        setUserGroups((prev) => [...prev, { ...group, joined_at: new Date().toISOString() }])
        setSearchValue("")
        toast({
          title: "Success",
          description: `You've joined "${group.name}"`,
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to join group",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error joining group:", error)
      toast({
        title: "Error",
        description: "Failed to join group",
        variant: "destructive",
      })
    } finally {
      setIsJoining(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return

    setIsCreating(true)
    try {
      const result = await createGroup(newGroupName.trim(), newGroupDescription.trim() || undefined)

      if (result.success && result.group) {
        // Add to local state
        setUserGroups((prev) => [...prev, { ...result.group, joined_at: new Date().toISOString() }])

        // Reset form
        setNewGroupName("")
        setNewGroupDescription("")
        setIsCreateDialogOpen(false)

        toast({
          title: "Success",
          description: `Group "${result.group.name}" created successfully`,
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create group",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating group:", error)
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleLeaveGroup = async (groupId: string, groupName: string) => {
    try {
      const result = await leaveGroup(groupId)

      if (result.success) {
        // Remove from local state
        setUserGroups((prev) => prev.filter((group) => group.id !== groupId))
        toast({
          title: "Success",
          description: `You've left "${groupName}"`,
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to leave group",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error leaving group:", error)
      toast({
        title: "Error",
        description: "Failed to leave group",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading groups...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Groups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Create Section */}
        <div className="space-y-3">
          <GroupAutocomplete
            value={searchValue}
            onChange={setSearchValue}
            onGroupSelect={handleJoinGroup}
            placeholder="Search for groups to join..."
            label="Find Groups"
            disabled={isJoining}
          />

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full bg-transparent">
                <Plus className="w-4 h-4 mr-2" />
                Create New Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input
                    id="group-name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Enter group name..."
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-description">Description (Optional)</Label>
                  <Textarea
                    id="group-description"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    placeholder="Describe your group..."
                    rows={3}
                    disabled={isCreating}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateGroup} disabled={isCreating || !newGroupName.trim()}>
                    {isCreating ? "Creating..." : "Create Group"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* User's Groups */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Your Groups ({userGroups.length})</h4>
          {userGroups.length > 0 ? (
            <div className="space-y-2">
              {userGroups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{group.name}</div>
                    {group.description && <div className="text-xs text-muted-foreground mt-1">{group.description}</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      Joined {new Date(group.joined_at!).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.creator_id === userId && (
                      <Badge variant="secondary" className="text-xs">
                        Creator
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLeaveGroup(group.id, group.name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">You haven't joined any groups yet.</p>
              <p className="text-xs">Search for groups above or create your own!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
