"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const sb = createClient();
      if (!sb) {
        setReady(true);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) setError("That reset link is invalid or has expired. Request a new one.");
        }
      }
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setHasSession(Boolean(data.session));
      setReady(true);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    const sb = createClient();
    if (!sb) {
      setError("Password reset needs the Supabase configuration.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Password updated. Taking you to the dashboard…");
    window.setTimeout(() => router.replace("/dashboard"), 900);
  }

  return (
    <main className="auth-shell">
      <div className="auth-topbar">
        <Link className="brand" href="/">
          <span className="brand-prompt">&gt;</span>
          <span className="brand-name">IELTShack</span>
        </Link>
        <Link className="auth-link" href="/auth">← Back to sign in</Link>
      </div>

      <div className="auth-card">
        <h1 className="auth-title">Set a new password.</h1>
        <p className="auth-sub">
          {hasSession
            ? "Choose a new password for your account."
            : "Open the reset link from your email, then come back to this page."}
        </p>

        {!ready ? (
          <p className="auth-feedback">Checking your reset link…</p>
        ) : hasSession ? (
          <form className="auth-form" onSubmit={submit} noValidate>
            <label className="field">
              <span className="field-label">New password</span>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span className="field-label">Confirm password</span>
              <input
                className="field-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat it"
                autoComplete="new-password"
              />
            </label>
            {error && <p className="field-error">{error}</p>}
            {message && <p className="auth-feedback">{message}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? "Updating…" : "Update password →"}
            </button>
          </form>
        ) : (
          <>
            {error && <p className="field-error">{error}</p>}
            <Link className="btn btn-primary btn-block" href="/auth/forgot">
              Request a new link →
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
