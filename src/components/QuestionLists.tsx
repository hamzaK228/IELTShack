"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QuestionRow from "./QuestionRow";
import type { QuestionEntry } from "@/lib/content";
import { getSaved, subscribe, toggleSaved } from "@/lib/storage";
import { useAppData } from "@/lib/useAppData";

async function fetchByIds(ids: string[]): Promise<QuestionEntry[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({ ids: ids.slice(0, 200).join(","), limit: "200" });
  const res = await fetch(`/api/questions?${params.toString()}`);
  const data = (await res.json()) as { items: QuestionEntry[] };
  return data.items ?? [];
}

export function MissQueue() {
  const { loaded, attempts } = useAppData();
  const [entries, setEntries] = useState<QuestionEntry[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const sync = () => setSaved(getSaved());
    sync();
    return subscribe(sync);
  }, []);

  const ids = useMemo(() => {
    const set = new Set<string>();
    attempts.forEach((attempt) => attempt.missed.forEach((id) => set.add(id)));
    return Array.from(set);
  }, [attempts]);
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
        <Link className="btn btn-primary" href="/dashboard/session">Practice now →</Link>
      </div>

      <div className="dash-card">
        {fetching ? (
          <p className="dash-empty">Loading your misses…</p>
        ) : entries.length === 0 ? (
          <div className="dash-empty">
            Nothing to review yet. Finish a session and any misses land here.
          </div>
        ) : (
          <div className="review-list">
            {entries.map((entry) => (
              <QuestionRow
                key={`${entry.testId}-${entry.question.id}`}
                entry={entry}
                saved={saved.includes(entry.question.id)}
                onToggleSave={() => setSaved(toggleSaved(entry.question.id))}
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
