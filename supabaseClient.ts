
import { createClient } from '@supabase/supabase-js';

// This file configures the Supabase client for the application.

// IMPORTANT:
// 1. Replace the placeholder values below with your actual Supabase project URL and anon key.
//    You can find these in your Supabase project's settings under "API".
// 2. In a real application, these should be stored securely in environment variables.

const supabaseUrl = 'https://nnubisajpuxyubqyeupg.supabase.co'; // REPLACE with your Supabase URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJpc2FqcHV4eXVicXlldXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjAxMzEsImV4cCI6MjA3NTczNjEzMX0.lUSkW4iWUpXobLkkczrPPAMHjCSJh4sv5dA5lzEEANg'; // REPLACE with your Supabase anon key

// Basic validation to remind the developer to replace placeholders.
if (supabaseUrl.includes('example.supabase.co') || supabaseAnonKey.includes('example-anon-key')) {
    const warningStyle = 'background: #ffdddd; color: #d8000c; padding: 10px; font-weight: bold; border-radius: 5px;';
    console.warn('%cWARNING: Supabase credentials are placeholders. Please update supabaseClient.ts with your project URL and anon key.', warningStyle);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*
 🚨🚨🚨 IMPORTANT DATABASE SETUP REQUIRED 🚨🚨🚨
 The application will NOT work correctly until you run the SQL commands below.

 How to fix:
 1. Go to your Supabase project dashboard.
 2. Navigate to the "SQL Editor" section.
 3. Click "+ New query".
 4. Copy the ENTIRE SQL block below (from "-- Create PROFILES table..." to the end).
 5. Paste it into the SQL Editor.
 6. Click the "RUN" button.

 This will create all the necessary tables (like 'profiles' and 'rides') and functions for the app to work.
 ---------------------------------------------------------------------------------------------------------

 -- TROUBLESHOOTING: If you are seeing an error like "invalid input syntax for type bigint",
 -- it is very likely that your `profiles` table was created with an `id` column
 -- of the wrong type (e.g., BIGINT instead of UUID). The `id` in the `profiles` table MUST
 -- be of type UUID to match Supabase's user authentication IDs. You may need to delete
 -- your existing `profiles` and `rides` tables and re-run this entire script to fix the issue.

 -- Create PROFILES table to store user data
 CREATE TABLE public.profiles (
   id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
   full_name TEXT,
   avatar_url TEXT,
   phone TEXT,
   latitude FLOAT8,
   longitude FLOAT8,
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Set up Row Level Security (RLS) for the profiles table
 ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
 CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
 CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

 -- Create a trigger to automatically create a profile when a new user signs up
 CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS TRIGGER AS $$
 BEGIN
   INSERT INTO public.profiles (id, full_name, avatar_url, phone)
   VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'phone');
   RETURN new;
 END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;

 CREATE TRIGGER on_auth_user_created
   AFTER INSERT ON auth.users
   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

 -- Create AVATARS bucket in Supabase Storage
 -- Go to the Supabase Dashboard: Storage -> Create a new bucket -> Name: "avatars", Public bucket: checked.
 -- Add policies to allow users to manage their own avatars.

 -- Create RIDES table for ride history
 CREATE TABLE public.rides (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    from_location TEXT,
    to_location TEXT,
    price TEXT,
    vehicle_type TEXT
 );

 -- Set up Row Level Security (RLS) for the rides table
 ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Users can view their own rides." ON public.rides FOR SELECT USING (auth.uid() = user_id);
 CREATE POLICY "Users can insert their own rides." ON public.rides FOR INSERT WITH CHECK (auth.uid() = user_id);

*/
