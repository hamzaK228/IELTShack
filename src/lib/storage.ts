"use client";

import type { Attempt, Profile } from "./types";

const PREFIX = "ieltshack:";
const UPDATE_EVENT = "ieltshack:update";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch {
    // Storage can be unavailable in private modes — the session stays in memory.
  }
}

export function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UPDATE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(UPDATE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getProfile(): Profile | null {
  return read<Profile | null>("profile", null);
}

export function saveProfile(profile: Profile) {
  write("profile", profile);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ieltshack:profile", { detail: profile }));
  }
}

/** Write the profile without announcing it for remote sync (used when pulling). */
export function setProfileLocal(profile: Profile) {
  write("profile", profile);
}

export function updateProfile(patch: Partial<Profile>) {
  const current = getProfile();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveProfile(next);
  return next;
}

export function createProfile(input: { name: string; email: string }): Profile {
  const profile: Profile = {
    name: input.name.trim() || "there",
    email: input.email.trim().toLowerCase(),
    targetBand: 7.5,
    currentBand: null,
    testDate: null,
    hoursPerWeek: 8,
    createdAt: new Date().toISOString(),
  };
  saveProfile(profile);
  return profile;
}

export function signOut() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PREFIX + "profile");
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function getAttempts(): Attempt[] {
  return read<Attempt[]>("attempts", []);
}

export function saveAttempt(attempt: Attempt) {
  const attempts = getAttempts();
  attempts.unshift(attempt);
  write("attempts", attempts.slice(0, 200));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ieltshack:attempt", { detail: attempt }));
  }
}

/** Replace the attempt cache after a pull. */
export function replaceAttempts(attempts: Attempt[]) {
  write("attempts", attempts.slice(0, 200));
}

export function getSaved(): string[] {
  return read<string[]>("saved", []);
}

export function toggleSaved(questionId: string) {
  const saved = getSaved();
  const next = saved.includes(questionId)
    ? saved.filter((id) => id !== questionId)
    : [questionId, ...saved];
  write("saved", next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ieltshack:saved", {
        detail: { questionId: questionId, saved: next.includes(questionId) },
      })
    );
  }
  return next;
}

/** Replace the saved cache after a pull. */
export function replaceSaved(ids: string[]) {
  write("saved", ids);
}

export function resetProgress() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PREFIX + "attempts");
  window.localStorage.removeItem(PREFIX + "saved");
  window.localStorage.removeItem(PREFIX + "vocab");
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export type VocabState = Record<string, { known: boolean; seen: number }>;

export function getVocabState(): VocabState {
  return read<VocabState>("vocab", {});
}

export function setVocabState(state: VocabState, changedWord?: string) {
  write("vocab", state);
  if (typeof window !== "undefined" && changedWord) {
    window.dispatchEvent(
      new CustomEvent("ieltshack:vocab", {
        detail: { word: changedWord, entry: state[changedWord] },
      })
    );
  }
}

/** Replace the vocabulary cache after a pull. */
export function replaceVocab(state: VocabState) {
  write("vocab", state);
}
