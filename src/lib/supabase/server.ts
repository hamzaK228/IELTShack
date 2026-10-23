import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const serverAuthConfigured = Boolean(url && anonKey);

/** Server-side session check for dashboard layouts and protected pages. */
export async function getServerUser() {
  if (!serverAuthConfigured) return null;
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always set cookies; the browser client refreshes them.
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
