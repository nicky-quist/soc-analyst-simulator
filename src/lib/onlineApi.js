// Network calls for the online leaderboard. Every function throws a readable
// Error on failure; callers decide how to show it. Failures never block local
// play.

import { getSupabase } from './supabase.js';

function redirectUrl() {
  return window.location.origin + window.location.pathname;
}

// Set just before leaving for the provider, so a later ?code= in the URL is
// known to be ours and not some unrelated query string.
const PENDING_KEY = 'soc-analyst-sim:online:pending';
export const MODE_KEY = 'soc-analyst-sim:leaderboard-mode';

function markPending() {
  try {
    window.localStorage.setItem(PENDING_KEY, '1');
  } catch {
    // Storage unavailable: sign-in still works, it just won't auto-return.
  }
}

// Called once at startup. True when the browser has just come back from a
// sign-in redirect (success or failure).
export function consumeSignInReturn() {
  try {
    const pending = window.localStorage.getItem(PENDING_KEY) === '1';
    const params = new URLSearchParams(window.location.search);
    const returned = pending && (params.has('code') || params.has('error'));
    if (pending) window.localStorage.removeItem(PENDING_KEY);
    return returned;
  } catch {
    return false;
  }
}

// The provider's error text when a sign-in came back as a failure.
export function signInReturnError() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('error')) return null;
  return params.get('error_description') || params.get('error');
}

// Drop ?code=... from the address bar once the session is stored.
export function cleanSignInUrl() {
  if (!window.location.search) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.hash);
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
  markPending();
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl() } });
  if (error) throw new Error(error.message);
}

export async function signInWithEmail(email) {
  markPending();
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
