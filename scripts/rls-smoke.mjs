#!/usr/bin/env node
/**
 * Two-account RLS smoke test. Creates two temporary auth users, verifies row
 * isolation, and deletes them in a finally block.
 *
 * Required env (never commit these values):
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import crypto from "node:crypto";

const base = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!base || !anon || !service) {
  console.error("Missing Supabase URL, anon key, or service-role key.");
  process.exit(1);
}

const stamp = Date.now();
const password = `T!${crypto.randomUUID()}`;
const emails = [`rls-${stamp}-a@example.com`, `rls-${stamp}-b@example.com`];
const adminHeaders = { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" };
const results = {};
let userA;
let userB;

const read = async (response) => {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
};

async function createUser(email) {
  const response = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = await read(response);
  if (!response.ok) throw new Error(`create user failed: ${response.status}`);
  return data;
}

async function token(email) {
  const response = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await read(response);
  if (!response.ok) throw new Error(`sign-in failed: ${response.status}`);
  return data.access_token;
}

const auth = (accessToken) => ({
  apikey: anon,
  authorization: `Bearer ${accessToken}`,
  "content-type": "application/json",
});

try {
  userA = await createUser(emails[0]);
  userB = await createUser(emails[1]);
  const tokenA = await token(emails[0]);
  const tokenB = await token(emails[1]);

  const insert = await fetch(`${base}/rest/v1/ielts_attempts`, {
    method: "POST",
    headers: { ...auth(tokenA), Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userA.id,
      test_id: "rls-smoke",
      test_title: "RLS smoke",
      mode: "practice",
      finished_at: new Date().toISOString(),
      overall_band: 6,
      correct: 1,
      total: 1,
    }),
  });
  results.ownInsertStatus = insert.status;

  const otherRead = await fetch(`${base}/rest/v1/ielts_attempts?select=id&user_id=eq.${userA.id}`, {
    headers: auth(tokenB),
  });
  results.otherCanReadMyAttempts = ((await read(otherRead)) ?? []).length;

  const forge = await fetch(`${base}/rest/v1/ielts_attempts`, {
    method: "POST",
    headers: { ...auth(tokenB), Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userA.id,
      test_id: "rls-forge",
      test_title: "Forge",
      mode: "practice",
      finished_at: new Date().toISOString(),
      overall_band: 9,
      correct: 1,
      total: 1,
    }),
  });
  results.otherCanInsertForMeStatus = forge.status;

  const post = await fetch(`${base}/rest/v1/ielts_community_posts`, {
    method: "POST",
    headers: { ...auth(tokenA), Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userA.id, author: "RLS smoke", body: "Temporary RLS smoke post" }),
  });
  const postData = await read(post);
  results.communityPostStatus = post.status;
  const postId = postData?.[0]?.id;

  const otherReadsPost = await fetch(`${base}/rest/v1/ielts_community_posts?select=id&id=eq.${postId}`, {
    headers: auth(tokenB),
  });
  results.otherCanReadCommunityPost = ((await read(otherReadsPost)) ?? []).length;

  const otherDelete = await fetch(`${base}/rest/v1/ielts_community_posts?id=eq.${postId}`, {
    method: "DELETE",
    headers: auth(tokenB),
  });
  results.otherDeleteStatus = otherDelete.status;

  const stillThere = await fetch(`${base}/rest/v1/ielts_community_posts?select=id&id=eq.${postId}`, {
    headers: auth(tokenA),
  });
  results.postStillExistsAfterOtherDelete = ((await read(stillThere)) ?? []).length;
} finally {
  for (const user of [userA, userB]) {
    if (user?.id) {
      await fetch(`${base}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: adminHeaders });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}
