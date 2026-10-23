"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAttempts, getProfile, resetProgress, updateProfile } from "@/lib/storage";
import { resetRemoteProgress, signOutRemote, syncProfile } from "@/lib/remote";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    targetBand: "7.5",
    currentBand: "",
    testDate: "",
    hoursPerWeek: "8",
  });

  useEffect(() => {
    const profile = getProfile();
    if (!profile) {
      router.replace("/auth");
      return;
    }
    setForm({
      name: profile.name,
      email: profile.email,
      targetBand: profile.targetBand.toFixed(1),
      currentBand: profile.currentBand != null ? profile.currentBand.toFixed(1) : "",
      testDate: profile.testDate ?? "",
      hoursPerWeek: String(profile.hoursPerWeek),
    });
    setReady(true);
  }, [router]);

  function save() {
    const next = updateProfile({
      name: form.name.trim() || "there",
      email: form.email.trim().toLowerCase(),
      targetBand: Number(form.targetBand) || 7.5,
      currentBand: form.currentBand === "" ? null : Number(form.currentBand),
      testDate: form.testDate || null,
      hoursPerWeek: Number(form.hoursPerWeek) || 8,
    });
    if (next) void syncProfile(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function deleteAccount() {
    const sure = window.confirm(
      "This permanently deletes your IELTShack data: attempts, saved questions, drafts, ratings, plan state and community posts. Your shared ecosystem login (SAThack) stays active. Continue?"
    );
    if (!sure) return;
    const sb = createClient();
    if (!sb) return;
    const { error } = await sb.rpc("ielts_delete_my_account");
    if (error) {
      window.alert("Could not delete your IELTShack data: " + error.message);
      return;
    }
    resetProgress();
    await signOutRemote();
    window.alert("IELTShack data deleted. Your shared login remains active — sign in again to start fresh.");
    router.push("/");
  }

  function exportData() {
    const local: Record<string, unknown> = {};
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("ieltshack:") || key === "ieltshack:profile" || key === "ieltshack:attempts") continue;
      try {
        local[key.replace("ieltshack:", "")] = JSON.parse(window.localStorage.getItem(key) ?? "null");
      } catch {
        local[key.replace("ieltshack:", "")] = window.localStorage.getItem(key);
      }
    }
    const data = { profile: getProfile(), attempts: getAttempts(), local };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ieltshack-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return null;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Settings</h1>
          <p className="dash-sub">Goals, profile, and local data.</p>
        </div>
        {saved && <span className="chip good">Saved</span>}
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Profile</h2>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">Name</span>
            <input
              className="field-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Goals</h2>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">Target band</span>
            <input
              className="field-input"
              type="number"
              min={0}
              max={9}
              step={0.5}
              value={form.targetBand}
              onChange={(e) => setForm({ ...form, targetBand: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Current band</span>
            <input
              className="field-input"
              type="number"
              min={0}
              max={9}
              step={0.5}
              value={form.currentBand}
              onChange={(e) => setForm({ ...form, currentBand: e.target.value })}
              placeholder="—"
            />
          </label>
          <label className="field">
            <span className="field-label">Test date</span>
            <input
              className="field-input"
              type="date"
              value={form.testDate}
              onChange={(e) => setForm({ ...form, testDate: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Hours per week</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={40}
              value={form.hoursPerWeek}
              onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value })}
            />
          </label>
        </div>
        <button className="btn btn-primary" onClick={save} style={{ marginTop: "1rem" }}>
          Save changes
        </button>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Data</h2>
        <p className="attempt-meta">
          Progress is stored in this browser only. Export it before clearing your browser data.
        </p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <button className="btn btn-ghost" onClick={exportData}>Download my data</button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (window.confirm("Reset all attempts, saved questions, and vocabulary progress?")) {
                void resetRemoteProgress();
                resetProgress();
              }
            }}
          >
            Reset progress
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await signOutRemote();
              router.push("/");
            }}
          >
            Sign out
          </button>
          <button className="btn btn-ghost danger" onClick={deleteAccount}>
            Delete IELTShack data
          </button>
        </div>
      </div>
    </div>
  );
}
