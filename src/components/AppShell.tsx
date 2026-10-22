"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getProfile, subscribe } from "@/lib/storage";
import { getSupabaseUser, initRemoteSync, isAdminRemote, pullRemote, remoteEnabled } from "@/lib/remote";
import type { Profile } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  { href: "/dashboard/plan", label: "Study Plan", icon: "▤" },
  { href: "/dashboard/session", label: "Practice", icon: "⚡" },
  { href: "/dashboard/test", label: "Practice Tests", icon: "▣" },
  { href: "/dashboard/mock", label: "Mock Exam", icon: "◉" },
  { href: "/dashboard/review", label: "Review Queue", icon: "↻" },
  { href: "/dashboard/vocab", label: "Vocabulary", icon: "Aa" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "◔" },
  { href: "/dashboard/leaderboard", label: "Progress", icon: "🏆" },
  { href: "/dashboard/tutor", label: "AI Tutor", icon: "🤖" },
  { href: "/dashboard/community", label: "Community", icon: "◎" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
  { href: "/dashboard/admin/console", label: "Admin console", icon: "⌘" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = () => setProfile(getProfile());
    sync();
    const unsubscribe = subscribe(sync);

    async function boot() {
      if (!remoteEnabled()) {
        if (!getProfile()) {
          router.replace("/auth");
          return;
        }
        if (!cancelled) setAuthReady(true);
        return;
      }
      const user = await getSupabaseUser();
      if (!user) {
        if (!cancelled) router.replace("/auth");
        return;
      }
      initRemoteSync();
      await pullRemote();
      if (!cancelled) setAuthReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const first = sidebarRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!authReady || profile === undefined) {
    return (
      <div className="app-boot">
        <span className="brand-prompt">&gt;</span> loading ieltshack…
      </div>
    );
  }
  if (profile === null) return null;

  const workspace = /^\/dashboard\/(test\/[^/]+|mock)/.test(pathname);
  const label =
    [...NAV]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) =>
        item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
      )?.label ?? "Dashboard";

  return (
    <div className={`dash-layout no-rail${collapsed ? " sidebar-collapsed" : ""}${workspace ? " exam-workspace" : ""}`}>
      <a className="skip-link" href="#app-main">Skip to content</a>
      {!open && (
        <button
          className="dash-nav-toggle"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      )}

      {open && (
        <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <aside ref={sidebarRef} className={`dash-sidebar${open ? " open" : ""}`} aria-label="Navigation">
        <div className="dash-sidebar-head">
          <Link className="brand dash-brand" href="/dashboard">
            <span className="brand-prompt">&gt;</span>
            <span>IELTShack</span>
          </Link>
          <button
            className="dash-tool close-sidebar"
            onClick={() => (window.matchMedia("(max-width: 1100px)").matches ? setOpen(false) : setCollapsed(true))}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="dash-nav" aria-label="Main">
          <span className="dash-nav-label">Menu</span>
          {NAV.filter((item) => item.href !== "/dashboard/admin/console" || isAdmin).map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : item.href === "/dashboard/admin"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dash-nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="dash-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <nav className="dash-nav" aria-label="Quick actions">
          <span className="dash-nav-label">Quick start</span>
          <Link className="dash-nav-link dash-nav-quick" href="/dashboard/diagnostic">
            <span className="dash-nav-icon" aria-hidden="true">◎</span>
            Diagnostic
          </Link>
          <Link className="dash-nav-link dash-nav-quick" href="/dashboard/mock">
            <span className="dash-nav-icon" aria-hidden="true">◉</span>
            Mock exam
          </Link>
        </nav>

        <div className="dash-sidebar-foot">
          <Link className="dash-nav-link" href="/">
            <span className="dash-nav-icon" aria-hidden="true">↖</span>
            Back to site
          </Link>
          <div className="dash-user" title={profile.email}>
            <span className="dash-user-dot" aria-hidden="true" />
            <span className="dash-user-email">{profile.email || profile.name}</span>
          </div>
        </div>
      </aside>

      <main className="dash-main" id="app-main">
        <div className="dash-toolbar">
          {collapsed && (
            <button
              className="dash-tool"
              onClick={() => setCollapsed(false)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
          )}
          <button className="dash-tool" onClick={() => router.back()} aria-label="Back">
            ← <span>Back</span>
          </button>
          <span className="dash-toolbar-label">{label}</span>
        </div>
        <div className="dash-route-motion" key={pathname}>
          {children}
        </div>
      </main>
    </div>
  );
}
