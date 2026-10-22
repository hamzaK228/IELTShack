"use client";

import { useEffect, useState } from "react";
import { getAttempts, getProfile, subscribe } from "./storage";
import type { Attempt, Profile } from "./types";

export function useAppData() {
  const [state, setState] = useState<{ loaded: boolean; profile: Profile | null; attempts: Attempt[] }>({
    loaded: false,
    profile: null,
    attempts: [],
  });

  useEffect(() => {
    const sync = () =>
      setState({ loaded: true, profile: getProfile(), attempts: getAttempts() });
    sync();
    return subscribe(sync);
  }, []);

  return state;
}

export function levelFor(xp: number) {
  const level = Math.floor(xp / 250) + 1;
  const titles = [
    "Rookie", "Starter", "Grinder", "Climber", "Achiever",
    "Sharp", "Advanced", "Elite", "Master", "GOATED",
  ];
  return { level, title: titles[Math.min(level - 1, titles.length - 1)], xp };
}

export function computeStreak(attempts: Attempt[]) {
  const days = new Set(
    attempts.map((a) => new Date(a.finishedAt).toISOString().slice(0, 10))
  );
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    // Allow the streak to be "alive" if today has no session yet.
    if (i === 0) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}
