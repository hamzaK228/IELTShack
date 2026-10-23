"use client";

import { createClient, supabaseEnabled } from "./supabase/client";
import {
  createProfile,
  getProfile,
  replaceAttempts,
  replaceReviewedMisses,
  replaceSaved,
  replaceVocab,
  setProfileLocal,
  signOut as clearLocalSession,
  type VocabState,
} from "./storage";
import type { Attempt, Profile } from "./types";

let currentUserId: string | null = null;
let initialized = false;

declare global {
  interface Window {
    __ieltsRemote?: {
      initialized: boolean;
      userId: string | null;
      attempts: number;
      saved: number;
      vocab: number;
      lastError: string | null;
    };
  }
}

function client() {
  return createClient();
}

function profileRow(profile: Profile) {
  return {
    id: currentUserId,
    email: profile.email,
    full_name: profile.name,
    target_band: profile.targetBand,
    current_band: profile.currentBand,
    test_date: profile.testDate,
    hours_per_week: profile.hoursPerWeek,
  };
}

function mapProfile(row: Record<string, unknown>, fallbackEmail = ""): Profile {
  return {
    name: String(row.full_name ?? "there"),
    email: String(row.email ?? fallbackEmail),
    targetBand: Number(row.target_band ?? 7.5),
    currentBand: row.current_band == null ? null : Number(row.current_band),
    testDate: (row.test_date as string | null) ?? null,
    hoursPerWeek: Number(row.hours_per_week ?? 8),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapAttempt(row: Record<string, unknown>): Attempt {
  return {
    id: String(row.id),
    testId: String(row.test_id),
    testTitle: String(row.test_title),
    mode: row.mode === "practice" ? "practice" : "exam",
    startedAt: String(row.started_at ?? row.finished_at),
    finishedAt: String(row.finished_at),
    durationSeconds: Number(row.duration_seconds ?? 0),
    answers: (row.answers as Attempt["answers"]) ?? {},
    perSkill: (row.per_skill as Attempt["perSkill"]) ?? {},
    overallBand: Number(row.overall_band ?? 0),
    correct: Number(row.correct ?? 0),
    total: Number(row.total ?? 0),
    missed: (row.missed as string[]) ?? [],
  };
}

export function remoteEnabled() {
  return supabaseEnabled;
}

export async function getSupabaseUser() {
  const sb = client();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  currentUserId = data.user?.id ?? null;
  return data.user ?? null;
}

function friendly(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) return "That email and password don't match.";
  if (text.includes("email not confirmed")) return "Confirm your email first — check your inbox for the link.";
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts — wait a minute and try again.";
  }
  if (text.includes("password")) return "Use at least 8 characters for your password.";
  return message;
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const sb = client();
  if (!sb) return { error: "Supabase is not configured." as string };
  const { data, error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: name.trim() || "there" },
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: friendly(error.message) };

  if (!data.session) {
    return { ok: true, needsConfirmation: true };
  }

  currentUserId = data.user?.id ?? null;
  const profile = createProfile({ name, email });
  if (currentUserId) {
    await sb.from("ielts_profiles").upsert(profileRow(profile), { onConflict: "id" });
  }
  return { ok: true, needsConfirmation: false };
}

export async function signInWithEmail(email: string, password: string) {
  const sb = client();
  if (!sb) return { error: "Supabase is not configured." as string };
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { error: friendly(error.message) };

  currentUserId = data.user?.id ?? null;
  await pullRemote();
  return { ok: true };
}

export async function signOutRemote() {
  const sb = client();
  if (sb) await sb.auth.signOut();
  clearLocalSession();
}

/** Pull this user's profile, attempts, saved questions and vocabulary into the local cache. */
export async function pullRemote() {
  const sb = client();
  if (!sb) return false;
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return false;
  currentUserId = user.id;

  const [profileRes, attemptsRes, savedRes, vocabRes, reviewRes] = await Promise.all([
    sb.from("ielts_profiles").select("*").eq("id", user.id).maybeSingle(),
    sb.from("ielts_attempts").select("*").eq("user_id", user.id).order("finished_at", { ascending: false }),
    sb.from("ielts_saved_questions").select("question_id").eq("user_id", user.id),
    sb.from("ielts_vocab_progress").select("word, known, seen").eq("user_id", user.id),
    sb.from("ielts_review_items").select("question_id").eq("user_id", user.id),
  ]);

  if (profileRes.data) {
    setProfileLocal(mapProfile(profileRes.data, user.email ?? ""));
  } else {
    const fallback = createProfile({
      name: (user.user_metadata?.full_name as string) ?? "there",
      email: user.email ?? "",
    });
    setProfileLocal(fallback);
    await sb.from("ielts_profiles").upsert(profileRow(fallback), { onConflict: "id" });
  }

  if (attemptsRes.data) replaceAttempts(attemptsRes.data.map(mapAttempt));
  if (savedRes.data) replaceSaved(savedRes.data.map((row) => String(row.question_id)));
  if (vocabRes.data) {
    const state: VocabState = {};
    for (const row of vocabRes.data) {
      state[String(row.word)] = { known: Boolean(row.known), seen: Number(row.seen ?? 0) };
    }
    replaceVocab(state);
  }
  if (reviewRes.data) {
    replaceReviewedMisses(reviewRes.data.map((row) => String(row.question_id)));
  }

  return true;
}

/** Push a profile change immediately (used by onboarding and settings). */
export async function syncProfile(profile: Profile) {
  const sb = client();
  if (!sb) return;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return;
  await sb.from("ielts_profiles").upsert(profileRow(profile), { onConflict: "id" });
}

export async function isAdminRemote(): Promise<boolean> {
  const sb = client();
  if (!sb) return false;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return false;
  const { data, error } = await sb.rpc("ielts_is_admin");
  return !error && data === true;
}

export async function fetchPlanTasks(): Promise<Record<string, boolean> | null> {
  const sb = client();
  if (!sb) return null;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return null;
  const { data, error } = await sb
    .from("ielts_plan_tasks")
    .select("task_key, done")
    .eq("user_id", currentUserId);
  if (error) return null;
  const result: Record<string, boolean> = {};
  for (const row of data ?? []) result[String(row.task_key)] = Boolean(row.done);
  return result;
}

export async function setPlanTask(taskKey: string, done: boolean) {
  const sb = client();
  if (!sb) return;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return;
  await sb.from("ielts_plan_tasks").upsert(
    { user_id: currentUserId, task_key: taskKey, done, updated_at: new Date().toISOString() },
    { onConflict: "user_id,task_key" }
  );
}

export type RemoteDraft = { text: string; checks: Record<number, boolean> };

export async function fetchWritingDraft(promptId: string): Promise<RemoteDraft | null> {
  const sb = client();
  if (!sb) return null;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return null;
  const { data, error } = await sb
    .from("ielts_writing_drafts")
    .select("text, checklist")
    .eq("user_id", currentUserId)
    .eq("prompt_id", promptId)
    .maybeSingle();
  if (error || !data) return null;
  return { text: String(data.text ?? ""), checks: (data.checklist as Record<number, boolean>) ?? {} };
}

export async function saveWritingDraft(promptId: string, text: string, checks: Record<number, boolean>) {
  const sb = client();
  if (!sb) return;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return;
  await sb.from("ielts_writing_drafts").upsert(
    {
      user_id: currentUserId,
      prompt_id: promptId,
      text,
      checklist: checks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,prompt_id" }
  );
}

export type RemoteRating = {
  promptId: string;
  at: string;
  overall: number;
  scores: Record<string, number>;
};

export async function fetchSpeakingRatings(): Promise<RemoteRating[] | null> {
  const sb = client();
  if (!sb) return null;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return null;
  const { data, error } = await sb
    .from("ielts_speaking_ratings")
    .select("prompt_id, scores, overall, created_at")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return null;
  return (data ?? []).map((row) => ({
    promptId: String(row.prompt_id),
    at: String(row.created_at),
    overall: Number(row.overall ?? 0),
    scores: (row.scores as Record<string, number>) ?? {},
  }));
}

export async function saveSpeakingRating(
  promptId: string,
  scores: Record<string, number>,
  overall: number
) {
  const sb = client();
  if (!sb) return;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return;
  await sb.from("ielts_speaking_ratings").insert({
    user_id: currentUserId,
    prompt_id: promptId,
    scores,
    overall,
  });
}

export type RemotePost = {
  id: string;
  author: string;
  body: string;
  likes: number;
  at: string;
  liked: boolean;
};

export async function fetchCommunityPosts(): Promise<RemotePost[] | null> {
  const sb = client();
  if (!sb) return null;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return null;

  const [postsRes, likesRes] = await Promise.all([
    sb.from("ielts_community_posts").select("id, author, body, likes, created_at").order("created_at", { ascending: false }).limit(50),
    sb.from("ielts_post_likes").select("post_id").eq("user_id", currentUserId),
  ]);
  if (postsRes.error) return null;
  const liked = new Set((likesRes.data ?? []).map((row) => String(row.post_id)));
  return (postsRes.data ?? []).map((row) => ({
    id: String(row.id),
    author: String(row.author),
    body: String(row.body),
    likes: Number(row.likes ?? 0),
    at: String(row.created_at),
    liked: liked.has(String(row.id)),
  }));
}

export async function createCommunityPost(author: string, body: string) {
  const sb = client();
  if (!sb) return false;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return false;
  const { error } = await sb.from("ielts_community_posts").insert({
    user_id: currentUserId,
    author,
    body: body.slice(0, 2000),
  });
  return !error;
}

export async function toggleCommunityLike(postId: string, liked: boolean) {
  const sb = client();
  if (!sb) return false;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return false;
  if (liked) {
    const { error } = await sb
      .from("ielts_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUserId);
    return !error;
  }
  const { error } = await sb
    .from("ielts_post_likes")
    .insert({ post_id: postId, user_id: currentUserId });
  return !error;
}

export type AdminReport = {
  id: string;
  test_id: string;
  question_id: string;
  reason: string;
  created_at: string;
};

export async function reportQuestion(testId: string, questionId: string, reason: string) {
  const sb = client();
  if (!sb) return false;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return false;
  const { error } = await sb.from("ielts_content_reports").upsert(
    {
      user_id: currentUserId,
      test_id: testId,
      question_id: questionId,
      reason: reason.trim().slice(0, 1000),
      status: "open",
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,question_id" }
  );
  return !error;
}

export async function fetchAdminReports(): Promise<AdminReport[] | null> {
  const sb = client();
  if (!sb) return null;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return null;
  const { data, error } = await sb.rpc("ielts_admin_reports");
  if (error || !Array.isArray(data)) return null;
  return data as AdminReport[];
}

export async function resolveAdminReport(id: string) {
  const sb = client();
  if (!sb) return false;
  const { error } = await sb.rpc("ielts_admin_resolve_report", { target: id });
  return !error;
}

export async function fetchReviewedMisses(): Promise<string[] | null> {
  const sb = client();
  if (!sb) return null;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return null;
  const { data, error } = await sb
    .from("ielts_review_items")
    .select("question_id")
    .eq("user_id", currentUserId);
  if (error) return null;
  return (data ?? []).map((row) => String(row.question_id));
}

export async function setReviewItem(questionId: string, reviewed: boolean) {
  const sb = client();
  if (!sb) return;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return;
  if (reviewed) {
    await sb.from("ielts_review_items").upsert(
      { user_id: currentUserId, question_id: questionId, reviewed_at: new Date().toISOString() },
      { onConflict: "user_id,question_id" }
    );
  } else {
    await sb.from("ielts_review_items").delete().eq("user_id", currentUserId).eq("question_id", questionId);
  }
}

export async function clearReviewItems() {
  const sb = client();
  if (!sb) return;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return;
  await sb.from("ielts_review_items").delete().eq("user_id", currentUserId);
}

/** Delete this user's practice data from Supabase (used by Settings → reset). */
export async function resetRemoteProgress() {
  const sb = client();
  if (!sb) return;
  if (!currentUserId) await getSupabaseUser();
  if (!currentUserId) return;
  await Promise.all([
    sb.from("ielts_attempts").delete().eq("user_id", currentUserId),
    sb.from("ielts_saved_questions").delete().eq("user_id", currentUserId),
    sb.from("ielts_vocab_progress").delete().eq("user_id", currentUserId),
    sb.from("ielts_plan_tasks").delete().eq("user_id", currentUserId),
    sb.from("ielts_review_items").delete().eq("user_id", currentUserId),
  ]);
}

/**
 * Start listening for local writes and mirror them to Supabase.
 * Safe to call more than once.
 */
export function initRemoteSync() {
  if (initialized || typeof window === "undefined") return;
  const sb = client();
  if (!sb) return;
  initialized = true;
  if (typeof window !== "undefined") {
    window.__ieltsRemote = {
      initialized: true,
      userId: currentUserId,
      attempts: 0,
      saved: 0,
      vocab: 0,
      lastError: null,
    };
  }

  window.addEventListener("ieltshack:profile", () => {
    const profile = getProfile();
    if (profile) void syncProfile(profile);
  });

  window.addEventListener("ieltshack:attempt", async (event) => {
    const attempt = (event as CustomEvent<Attempt>).detail;
    if (window.__ieltsRemote) window.__ieltsRemote.attempts += 1;
    if (!attempt) return;
    if (!currentUserId) await getSupabaseUser();
    if (!currentUserId) {
      if (window.__ieltsRemote) window.__ieltsRemote.lastError = "no user id for attempt";
      return;
    }
    const { error } = await sb.from("ielts_attempts").insert({
      user_id: currentUserId,
      test_id: attempt.testId,
      test_title: attempt.testTitle,
      mode: attempt.mode,
      started_at: attempt.startedAt,
      finished_at: attempt.finishedAt,
      duration_seconds: attempt.durationSeconds,
      answers: attempt.answers,
      per_skill: attempt.perSkill,
      overall_band: attempt.overallBand,
      correct: attempt.correct,
      total: attempt.total,
      missed: attempt.missed,
    });
    if (error && window.__ieltsRemote) window.__ieltsRemote.lastError = error.message;
  });

  window.addEventListener("ieltshack:saved", async (event) => {
    const detail = (event as CustomEvent<{ questionId: string; saved: boolean }>).detail;
    if (window.__ieltsRemote) window.__ieltsRemote.saved += 1;
    if (!detail) return;
    if (!currentUserId) await getSupabaseUser();
    if (!currentUserId) {
      if (window.__ieltsRemote) window.__ieltsRemote.lastError = "no user id for saved";
      return;
    }
    if (detail.saved) {
      const { error } = await sb.from("ielts_saved_questions").upsert(
        { user_id: currentUserId, question_id: detail.questionId },
        { onConflict: "user_id,question_id", ignoreDuplicates: true }
      );
      if (error && window.__ieltsRemote) window.__ieltsRemote.lastError = error.message;
    } else {
      void sb
        .from("ielts_saved_questions")
        .delete()
        .eq("user_id", currentUserId)
        .eq("question_id", detail.questionId);
    }
  });

  window.addEventListener("ieltshack:vocab", async (event) => {
    const detail = (event as CustomEvent<{ word: string; entry?: { known: boolean; seen: number } }>).detail;
    if (window.__ieltsRemote) window.__ieltsRemote.vocab += 1;
    if (!detail?.entry) return;
    if (!currentUserId) await getSupabaseUser();
    if (!currentUserId) {
      if (window.__ieltsRemote) window.__ieltsRemote.lastError = "no user id for vocab";
      return;
    }
    const { error } = await sb.from("ielts_vocab_progress").upsert(
      {
        user_id: currentUserId,
        word: detail.word,
        known: detail.entry.known,
        seen: detail.entry.seen,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,word" }
    );
    if (error && window.__ieltsRemote) window.__ieltsRemote.lastError = error.message;
  });

  // Keep the local mirror fresh when the tab regains focus on another device's changes.
  const onVisible = () => {
    if (document.visibilityState === "visible") void pullRemote();
  };
  document.addEventListener("visibilitychange", onVisible);
}
