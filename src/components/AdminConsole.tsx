"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

type TestSummary = { id: string; title: string; kind: string; questions: number };
type Stats = {
  profiles: number;
  attempts: number;
  posts: number;
  ratings: number;
  drafts: number;
  plan_tasks: number;
};
type Post = { id: string; author: string; body: string; likes: number; created_at: string };
type Report = {
  id: string;
  test_id: string;
  question_id: string;
  reason: string;
  created_at: string;
};

export default function AdminConsole({
  tests,
  questionCount,
}: {
  tests: TestSummary[];
  questionCount: number;
}) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const sb = createClient();
    if (!sb) return;
    const [statsRes, postsRes, reportsRes] = await Promise.all([
      sb.rpc("ielts_admin_stats"),
      sb
        .from("ielts_community_posts")
        .select("id, author, body, likes, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      sb.rpc("ielts_admin_reports"),
    ]);
    if (statsRes.error) setError(statsRes.error.message);
    else setStats(statsRes.data as Stats);
    if (postsRes.data) setPosts(postsRes.data as Post[]);
    if (Array.isArray(reportsRes.data)) setReports(reportsRes.data as Report[]);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!supabaseEnabled) {
        setChecking(false);
        return;
      }
      const sb = createClient();
      if (!sb) {
        setChecking(false);
        return;
      }
      const { data, error: rpcError } = await sb.rpc("ielts_is_admin");
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setChecking(false);
        return;
      }
      setAuthorized(Boolean(data));
      setChecking(false);
      if (data) await load();
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function resolveReport(id: string) {
    const sb = createClient();
    if (!sb) return;
    const { error: rpcError } = await sb.rpc("ielts_admin_resolve_report", { target: id });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await load();
  }

  async function removePost(id: string) {
    if (!window.confirm("Delete this community post?")) return;
    const sb = createClient();
    if (!sb) return;
    const { error: rpcError } = await sb.rpc("ielts_admin_delete_post", { target: id });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await load();
  }

  if (checking) {
    return (
      <div className="dash-page">
        <div className="dash-card dash-empty">Checking admin access…</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="dash-page">
        <div className="dash-head">
          <h1 className="dash-title">Admin console</h1>
        </div>
        <div className="dash-card dash-empty">
          <p>This area is for ecosystem admins only.</p>
          <p className="attempt-meta" style={{ marginTop: ".6rem" }}>
            Grant access in the Supabase SQL editor:{" "}
            <code>insert into public.ielts_admins (user_id) values (&apos;&lt;user-id&gt;&apos;);</code>
          </p>
          <Link className="btn btn-ghost" href="/dashboard" style={{ marginTop: "1rem" }}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const statCards: Array<[string, number]> = stats
    ? [
        ["Accounts", stats.profiles],
        ["Attempts", stats.attempts],
        ["Community posts", stats.posts],
        ["Speaking ratings", stats.ratings],
        ["Writing drafts", stats.drafts],
        ["Plan check-offs", stats.plan_tasks],
      ]
    : [];

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Admin console</h1>
          <p className="dash-sub">Platform health, content inventory, and moderation.</p>
        </div>
        <span className="chip good">admin</span>
      </div>

      {error && <div className="dash-card import-invalid">✗ {error}</div>}

      <div className="dash-stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {statCards.map(([label, value]) => (
          <div className="dash-stat-card" key={label}>
            <span className="dash-stat-label">{label}</span>
            <span className="dash-stat-value">{value}</span>
          </div>
        ))}
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-section-title">Content inventory</h2>
          <span style={{ display: "flex", gap: "1rem" }}>
            <Link className="auth-link" href="/dashboard/test">Practice tests →</Link>
          </span>
        </div>
        <p className="attempt-meta">
          {tests.length} test file{tests.length === 1 ? "" : "s"} · {questionCount} questions loaded
        </p>
        <ul className="attempt-list">
          {tests.map((test) => (
            <li className="attempt-row" key={test.id}>
              <div>
                <strong>{test.title}</strong>
                <span className="attempt-meta">{test.kind} · {test.questions} questions · {test.id}</span>
              </div>
              <Link className="session-chip session-ref-btn" href={`/dashboard/test/${test.id}`}>
                open
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Content reports</h2>
        {reports.length === 0 ? (
          <p className="dash-empty">No open question reports.</p>
        ) : (
          <ul className="attempt-list">
            {reports.map((report) => (
              <li className="attempt-row" key={report.id}>
                <div>
                  <strong>{report.test_id} · {report.question_id}</strong>
                  <span className="attempt-meta">
                    {new Date(report.created_at).toLocaleString()} · {report.reason}
                  </span>
                </div>
                <button className="btn btn-ghost" onClick={() => resolveReport(report.id)}>
                  Resolve
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Moderation</h2>
        {posts.length === 0 ? (
          <p className="dash-empty">No community posts yet.</p>
        ) : (
          <ul className="attempt-list">
            {posts.map((post) => (
              <li className="attempt-row" key={post.id}>
                <div>
                  <strong>{post.author}</strong>
                  <span className="attempt-meta">{new Date(post.created_at).toLocaleString()} · ♥ {post.likes}</span>
                  <span className="admin-post-body">{post.body}</span>
                </div>
                <button className="btn btn-ghost danger" onClick={() => removePost(post.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
