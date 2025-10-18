"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/admin"
import { select } from "@/lib/database/adapter"

export async function createGroupsTables() {
  try {
    await requireAdmin()

    const supabase = await createClient()

    console.log("[v0] Creating groups tables...")

    const groupsCheck = await select("groups", ["id"], undefined, undefined, 1)
    const userGroupsCheck = await select("user_groups", ["id"], undefined, undefined, 1)

    // If both tables exist (no error), return success
    if (!groupsCheck.error && !userGroupsCheck.error) {
      console.log("[v0] Groups tables already exist")
      return { success: true, message: "Groups tables already exist" }
    }

    // If tables don't exist, we need to create them
    // Since we can't execute DDL directly through the client, we'll provide instructions
    const sqlScript = `
-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name)
);

-- Create user_groups junction table
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups table
CREATE POLICY "Users can view all groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their groups" ON groups FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete their groups" ON groups FOR DELETE USING (auth.uid() = creator_id);

-- RLS Policies for user_groups table
CREATE POLICY "Users can view group memberships" ON user_groups FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON user_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON user_groups FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_creator_id ON groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);
`

    console.log("[v0] Groups tables need to be created manually")
    return {
      success: false,
      error:
        "Groups tables don't exist and need to be created manually. Please run the SQL script in your Supabase dashboard.",
      sqlScript,
    }
  } catch (error) {
    console.error("Groups table creation error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
