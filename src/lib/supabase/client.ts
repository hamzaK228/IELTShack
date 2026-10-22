"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for the shared ecosystem project.
 * IELTShack data lives in `ielts_*` tables so the SAThack tables are untouched.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export const supabaseEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
