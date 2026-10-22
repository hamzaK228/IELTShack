"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you signed up with.");
      return;
    }
    const sb = createClient();
    if (!sb) {
      setError("Password reset needs the Supabase configuration.");
      return;
    }
    setBusy(true);
    const { error: resetError } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
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
        <h1 className="auth-title">Reset your password.</h1>
        <p className="auth-sub">
          {supabaseEnabled
            ? "Enter your email and we will send a reset link."
            : "Password reset is unavailable without Supabase configuration."}
        </p>

        {sent ? (
          <>
            <p className="auth-feedback">
              If that email has an account, a reset link is on its way. Open it on this device.
            </p>
            <Link className="btn btn-ghost btn-block" href="/auth">Back to sign in</Link>
          </>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            {error && <p className="field-error">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
