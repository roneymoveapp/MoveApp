


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
 🚀🚀🚀 DATABASE SETUP 🚀🚀🚀
 The database for this application is managed via the SQL Editor in your Supabase dashboard.
 Please refer to the setup instructions provided separately to create the necessary tables,
 policies, and functions.
*/