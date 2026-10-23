import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerUser, serverAuthConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (serverAuthConfigured) {
    const user = await getServerUser();
    if (!user) redirect("/auth");
  }
  return <AppShell>{children}</AppShell>;
}
