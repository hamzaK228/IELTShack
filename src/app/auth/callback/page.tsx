"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Confirming your email…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sb = createClient();
    if (!sb) {
      setMessage("Supabase is not configured.");
      setFailed(true);
      return;
    }
    const code = params.get("code");
    const next = params.get("next") || "/dashboard";
    if (!code) {
      setMessage("This confirmation link is missing its code. Try signing in.");
      setFailed(true);
      return;
    }
    sb.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setMessage("That link is invalid or has expired. Sign in to request a new one.");
          setFailed(true);
          return;
        }
        router.replace(next);
      })
      .catch(() => {
        setMessage("Could not confirm the link. Try signing in.");
        setFailed(true);
      });
  }, [params, router]);

  return (
    <main className="auth-shell">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h1 className="auth-title">{failed ? "Link problem." : "One moment."}</h1>
        <p className="auth-sub">{message}</p>
        <div style={{ marginTop: "1.2rem", display: "flex", gap: ".7rem", justifyContent: "center", flexWrap: "wrap" }}>
          {failed && <Link className="btn btn-primary" href="/auth">Go to sign in →</Link>}
          <Link className="btn btn-ghost" href="/">Home</Link>
        </div>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
