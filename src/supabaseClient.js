import { createClient } from "@supabase/supabase-js";

// These are read from your environment (.env.local locally, or Vercel's
// Environment Variables in production). The key here is a PUBLIC key
// (Supabase "publishable" / legacy "anon" key) — it is safe to ship in a
// browser app *because* Row Level Security guards what it can do.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

// If the keys aren't set yet, the app shows a friendly setup screen
// instead of crashing.
export const isConfigured = Boolean(url && key);

export const supabase = isConfigured ? createClient(url, key) : null;
