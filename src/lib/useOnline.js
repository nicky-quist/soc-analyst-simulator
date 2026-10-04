// State for the Online leaderboard: who is signed in, their profile, and the
// standings table. Nothing loads (not even the Supabase bundle) until the
// Online view is opened. State is only set inside promise callbacks.

import { useCallback, useEffect, useState } from 'react';
import {
  cleanSignInUrl, fetchStandings, getMyProfile, getSession, onAuthChange, pushStanding,
} from './onlineApi.js';

const errText = (e) => {
  const message = e instanceof Error ? e.message : String(e);
  // PostgREST's wording when supabase/schema.sql has not been run yet.
  if (/schema cache|Could not find the function/i.test(message)) {
    return 'the online database is not set up yet. Run supabase/schema.sql in the Supabase SQL editor.';
  }
  return message;
};

export function useOnline({ active, clubOnly, payload }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    if (!active) return undefined;
    let off = () => {};
    let cancelled = false;
    getSession()
      .then((s) => {
        if (s) cleanSignInUrl();
        if (!cancelled) setSession(s);
      })
      .catch((e) => {
        if (cancelled) return;
        setSession(null);
        setError(errText(e));
      });
    onAuthChange((s) => {
      if (s) cleanSignInUrl();
      setSession(s);
    }).then((unsub) => { off = unsub; }).catch(() => {});
    return () => {
      cancelled = true;
      off();
    };
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    (session ? getMyProfile() : Promise.resolve(null))
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((e) => { if (!cancelled) setError(errText(e)); });
    return () => { cancelled = true; };
  }, [active, session, tick]);

  // Publish your standing, then read the table.
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const publish = session && profile ? pushStanding(JSON.parse(payloadKey)).catch(() => {}) : Promise.resolve();
    publish
      .then(() => fetchStandings(clubOnly))
      .then((data) => {
        if (cancelled) return;
        setRows(data ?? []);
        setError(null);
      })
      .catch((e) => { if (!cancelled) setError(errText(e)); });
    return () => { cancelled = true; };
  }, [active, session, profile, clubOnly, payloadKey, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { session, profile, rows, error, refresh };
}
