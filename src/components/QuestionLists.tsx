"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QuestionRow from "./QuestionRow";
import type { QuestionEntry } from "@/lib/content";
import {
  getReviewedMisses,
  getSaved,
  markMissReviewed,
  replaceReviewedMisses,
  resetReviewedMisses,
  subscribe,
  toggleSaved,
} from "@/lib/storage";
import { clearReviewItems, fetchReviewedMisses, remoteEnabled, setReviewItem } from "@/lib/remote";
import { useAppData } from "@/lib/useAppData";
import { authHeaders } from "@/lib/client-auth";

async function fetchByIds(ids: string[]): Promise<QuestionEntry[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({ ids: ids.slice(0, 200).join(","), limit: "200" });
  const headers = await authHeaders();
  const res = await fetch(`/api/questions?${params.toString()}`, { headers });
  const data = (await res.json()) as { items: QuestionEntry[] };
  return data.items ?? [];
}

export function MissQueue() {
  const { loaded, attempts } = useAppData();
  const [entries, setEntries] = useState<QuestionEntry[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const sync = () => {
      setSaved(getSaved());
      setReviewed(getReviewedMisses());
    };
    sync();
    return subscribe(sync);
  }, []);

  useEffect(() => {
    if (!remoteEnabled()) return;
    let cancelled = false;
    void fetchReviewedMisses().then((ids) => {
      if (cancelled || !ids) return;
      replaceReviewedMisses(ids);
      setReviewed(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reviewedSet = useMemo(() => new Set(reviewed), [reviewed]);
  const ids = useMemo(() => {
    const set = new Set<string>();
    attempts.forEach((attempt) =>
      attempt.missed.forEach((id) => {
        if (!reviewedSet.has(id)) set.add(id);
      })
    );
    return Array.from(set);
  }, [attempts, reviewedSet]);
  const idsKey = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    fetchByIds(ids)
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (!loaded) return null;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Review queue</h1>
          <p className="dash-sub">
            Every question you have missed, newest first. Clear it, then the queue refills with new misses.
          </p>
        </div>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          {reviewed.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                resetReviewedMisses();
                setReviewed([]);
                if (remoteEnabled()) void clearReviewItems();
              }}
            >
              Reset reviewed ({reviewed.length})
            </button>
          )}
          <Link className="btn btn-primary" href="/dashboard/session">Practice now →</Link>
        </div>
      </div>

      <div className="dash-card">
        {fetching ? (
          <p className="dash-empty">Loading your misses…</p>
        ) : entries.length === 0 ? (
          <div className="dash-empty">
            Nothing left in the queue. New misses appear after your next session.
          </div>
        ) : (
          <div className="review-list">
            {entries.map((entry) => (
              <QuestionRow
                key={`${entry.testId}-${entry.question.id}`}
                entry={entry}
                saved={saved.includes(entry.question.id)}
                onToggleSave={() => setSaved(toggleSaved(entry.question.id))}
                onMarkReviewed={() => {
                  setReviewed(markMissReviewed(entry.question.id));
                  if (remoteEnabled()) void setReviewItem(entry.question.id, true);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SavedList() {
  const [saved, setSaved] = useState<string[]>([]);
  const [entries, setEntries] = useState<QuestionEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const sync = () => setSaved(getSaved());
    sync();
    return subscribe(sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    fetchByIds(saved)
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [saved]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Saved questions</h1>
          <p className="dash-sub">Bookmarked questions stay here across sessions.</p>
        </div>
      </div>

      <div className="dash-card">
        {fetching ? (
          <p className="dash-empty">Loading saved questions…</p>
        ) : entries.length === 0 ? (
          <div className="dash-empty">
            No saved questions yet. Use ☆ Save on any question.
          </div>
        ) : (
          <div className="review-list">
            {entries.map((entry) => (
              <QuestionRow
                key={`${entry.testId}-${entry.question.id}`}
                entry={entry}
                saved
                onToggleSave={() => setSaved(toggleSaved(entry.question.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
