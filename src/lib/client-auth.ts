"use client";

import { createClient } from "./supabase/client";

/** Authorization header for routes that require the current ecosystem session. */
export async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  if (!supabase) return {};
  let { data } = await supabase.auth.getSession();
  if (data.session?.expires_at && data.session.expires_at * 1000 < Date.now() + 10_000) {
    const refreshed = await supabase.auth.refreshSession();
    data = refreshed.data;
  }
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}
