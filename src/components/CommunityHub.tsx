"use client";

import { useEffect, useState } from "react";
import {
  createCommunityPost,
  fetchCommunityPosts,
  remoteEnabled,
  toggleCommunityLike,
} from "@/lib/remote";

type Post = { id: string; author: string; body: string; at: string; likes: number; liked: boolean };

const SEED: Post[] = [
  { id: "p1", author: "Aisha", body: "Just hit Band 7.5 on a full mock. The review queue is what moved the needle — every miss, logged.", at: new Date(Date.now() - 3 * 3600_000).toISOString(), likes: 12, liked: false },
  { id: "p2", author: "Nguyen", body: "True/False/Not Given tip: if the passage talks about the topic but never makes the specific claim, it's Not Given — not False.", at: new Date(Date.now() - 9 * 3600_000).toISOString(), likes: 8, liked: false },
  { id: "p3", author: "Miu", body: "Anyone want to duel tonight? Aiming for 6.5 → 7.0 in Reading before my test in six weeks.", at: new Date(Date.now() - 26 * 3600_000).toISOString(), likes: 4, liked: false },
];

const GROUPS = [
  { name: "Band 7 sprint", members: 128, focus: "8-week plan · Academic" },
  { name: "Writing Task 2 clinic", members: 74, focus: "Essays · feedback swaps" },
  { name: "Listening drills", members: 96, focus: "Sections 3–4 · daily" },
];

export default function CommunityHub() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("You");
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (remoteEnabled()) {
      const remote = await fetchCommunityPosts();
      if (remote) {
        setPosts(remote);
        setLive(true);
        setLoading(false);
        return;
      }
    }
    try {
      const raw = window.localStorage.getItem("ieltshack:community");
      setPosts(raw ? JSON.parse(raw) : SEED);
    } catch {
      setPosts(SEED);
    }
    setLoading(false);
  }

  useEffect(() => {
    try {
      const profile = window.localStorage.getItem("ieltshack:profile");
      if (profile) setName(JSON.parse(profile).name ?? "You");
    } catch {
      // ignore
    }
    void refresh();
  }, []);

  function persistLocal(next: Post[]) {
    setPosts(next);
    window.localStorage.setItem("ieltshack:community", JSON.stringify(next));
  }

  async function post() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    if (remoteEnabled() && live) {
      const ok = await createCommunityPost(name, draft.trim());
      if (ok) {
        setDraft("");
        await refresh();
      }
    } else {
      persistLocal([
        { id: `p-${Date.now()}`, author: name, body: draft.trim(), at: new Date().toISOString(), likes: 0, liked: false },
        ...posts,
      ]);
      setDraft("");
    }
    setBusy(false);
  }

  async function like(current: Post) {
    if (remoteEnabled() && live) {
      await toggleCommunityLike(current.id, current.liked);
      await refresh();
      return;
    }
    persistLocal(
      posts.map((p) =>
        p.id === current.id
          ? { ...p, likes: Math.max(0, p.likes + (p.liked ? -1 : 1)), liked: !p.liked }
          : p
      )
    );
  }

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Community</h1>
          <p className="dash-sub">
            {live
              ? "Wins, tips, and study partners — shared through the IELTShack database."
              : "Wins, tips, and study partners. Sign in to sync posts across devices."}
          </p>
        </div>
        <span className={`chip ${live ? "good" : ""}`}>{live ? "live" : "local"}</span>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-section-title">Share something</h2>
          <span className="attempt-meta">posting as {name}</span>
        </div>
        <textarea
          className="field-input session-textarea"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="A tip that helped you, a score you're proud of, or a study partner request…"
        />
        <div style={{ marginTop: ".7rem" }}>
          <button className="btn btn-primary" onClick={post} disabled={!draft.trim() || busy}>
            {busy ? "Posting…" : "Post →"}
          </button>
        </div>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Feed</h2>
        {loading ? (
          <p className="dash-empty">Loading the feed…</p>
        ) : posts.length === 0 ? (
          <p className="dash-empty">No posts yet — be the first to share something.</p>
        ) : (
          <div className="community-feed">
            {posts.map((p) => (
              <article className="community-post" key={p.id}>
                <div className="community-post-head">
                  <span className="community-avatar">{p.author.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{p.author}</strong>
                    <span className="attempt-meta">{new Date(p.at).toLocaleString()}</span>
                  </div>
                </div>
                <p>{p.body}</p>
                <button
                  className={`session-chip session-ref-btn${p.liked ? " active" : ""}`}
                  onClick={() => like(p)}
                  aria-pressed={p.liked}
                >
                  {p.liked ? "♥" : "♡"} {p.likes}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Study groups</h2>
        <ul className="attempt-list">
          {GROUPS.map((group) => (
            <li className="attempt-row" key={group.name}>
              <div>
                <strong>{group.name}</strong>
                <span className="attempt-meta">{group.focus} · {group.members} members</span>
              </div>
              <span className="chip">join soon</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
