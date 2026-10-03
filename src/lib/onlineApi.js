// Network calls for the online leaderboard. Every function throws a readable
// Error on failure; callers decide how to show it. Failures never block local
// play.

import { getSupabase } from './supabase.js';

function redirectUrl() {
  return window.location.origin + window.location.pathname;
}

async function rpc(name, args) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function getSession() {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function onAuthChange(callback) {
  const sb = await getSupabase();
  const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signInWithProvider(provider) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl() } });
  if (error) throw new Error(error.message);
}

export async function signInWithEmail(email) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
}

export async function getMyProfile() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('profiles').select('display_name, club_member').maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export const setDisplayName = (name) => rpc('set_display_name', { p_name: name });
export const joinClub = (code) => rpc('join_club', { p_code: code });
export const fetchStandings = (clubOnly) => rpc('get_standings', { p_club_only: clubOnly });
export const pushStanding = (standing) => rpc('submit_standing', { p_standing: standing });

// True when a Supabase session is stored in this browser. A cheap check so
// signed-out players never load the Supabase bundle just to find that out.
export function hasStoredSession() {
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      if (/^sb-.+-auth-token$/.test(window.localStorage.key(i) ?? '')) return true;
    }
  } catch {
    // Storage unavailable: treat as signed out.
  }
  return false;
}

// Fire-and-forget. Does nothing when signed out, offline, or before the
// database is set up; the next sync (or opening the Leaderboard) retries.
export async function pushStandingQuietly(standing) {
  if (!hasStoredSession()) return;
  try {
    if (await getSession()) await pushStanding(standing);
  } catch {
    // Offline or not set up yet.
  }
}
