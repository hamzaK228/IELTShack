"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createProfile, getProfile, updateProfile } from "@/lib/storage";
import { remoteEnabled, signInWithEmail, signUpWithEmail } from "@/lib/remote";
import { createClient } from "@/lib/supabase/client";

type Mode = "signup" | "signin";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sb = createClient();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "signup" && name.trim().length < 2) {
      setError("Tell us your name so your plan can greet you.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter an email like you@example.com.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (remoteEnabled()) {
      setLoading(true);
      setMessage(null);
      const result =
        mode === "signup"
          ? await signUpWithEmail(name, email, password)
          : await signInWithEmail(email, password);
      setLoading(false);

      if (result.error) {
        setError(result.error);
        return;
      }
      if ("needsConfirmation" in result && result.needsConfirmation) {
        setMessage("Check your inbox and confirm your email, then sign in.");
        return;
      }
      router.push(mode === "signup" ? "/onboarding" : "/dashboard");
      return;
    }

    const existing = getProfile();
    if (existing) {
      updateProfile({ email: email.trim().toLowerCase(), name: name.trim() || existing.name });
      router.push("/dashboard");
      return;
    }

    createProfile({ name: name || "there", email });
    router.push(mode === "signup" ? "/onboarding" : "/dashboard");
  }

  function useDemo() {
    createProfile({ name: "Alex", email: "alex@ieltshack.app" });
    router.push("/onboarding");
  }

  return (
    <main className="auth-shell">
      <div className="auth-topbar">
        <Link className="brand" href="/">
          <span className="brand-prompt">&gt;</span>
          <span className="brand-name">IELTShack</span>
        </Link>
        <Link className="auth-link" href="/">← Back to site</Link>
      </div>

      <div className="auth-card">
        <h1 className="auth-title">
          {mode === "signup" ? "Start your band journey." : "Welcome back."}
        </h1>
        <p className="auth-sub">
          {mode === "signup"
            ? "Free while we build. No payment details, no credit card."
            : "Pick up where you left off."}
        </p>

        <div className="auth-tabs" aria-label="Account mode">
          <button
            type="button"
            aria-pressed={mode === "signup"}
            className={`auth-tab${mode === "signup" ? " active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
          <button
            type="button"
            aria-pressed={mode === "signin"}
            className={`auth-tab${mode === "signin" ? " active" : ""}`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === "signup" && (
            <label className="field">
              <span className="field-label">Full name</span>
              <input
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                autoComplete="name"
              />
            </label>
          )}

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

          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {error && <p className="field-error">{error}</p>}
          {message && <p className="auth-feedback">{message}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Working…" : mode === "signup" ? "Create account →" : "Sign in →"}
          </button>
        </form>

        {!remoteEnabled() && (
          <>
            <div className="auth-divider">or</div>
            <button type="button" className="btn btn-ghost btn-block" onClick={useDemo}>
              Continue with the demo account
            </button>
          </>
        )}

        {mode === "signin" && remoteEnabled() && (
          <p className="auth-alt">
            <Link className="auth-link" href="/auth/forgot">Forgot password?</Link>
          </p>
        )}

        <p className="auth-alt">
          {remoteEnabled()
            ? "One ecosystem account — works across IELTShack and SAThack. Progress syncs across devices."
            : "Demo mode: accounts are stored only in this browser."}
        </p>
      </div>
    </main>
  );
}
