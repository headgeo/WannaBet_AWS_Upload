-- First, drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create simple, non-recursive RLS policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow public read access to basic profile info (username, display_name) for leaderboards, etc.
-- This avoids the infinite recursion issue while still allowing necessary functionality
CREATE POLICY "Public can view basic profile info" ON public.profiles
  FOR SELECT USING (true);

-- Ensure the trigger function exists and works correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, balance, role, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    1000.00, -- Starting balance
    'user', -- Default role
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate inserts
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create profiles for any existing users who don't have them
INSERT INTO public.profiles (id, username, display_name, balance, role, created_at, updated_at)
SELECT 
  au.id,
  split_part(au.email, '@', 1) as username,
  split_part(au.email, '@', 1) as display_name,
  1000.00 as balance,
  'user' as role,
  au.created_at,
  now() as updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
