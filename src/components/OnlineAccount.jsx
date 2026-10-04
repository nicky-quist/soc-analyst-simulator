// Sign-in, display name and club code for the Online leaderboard. Only the
// display name and standings are ever shown to other players.

import { useState } from 'react';
import { C, FONT, TONE } from '../theme.js';
import { Badge, Button, Callout, Card, Field } from '../ui/primitives.jsx';
import {
  joinClub, setDisplayName, signInReturnError, signInWithEmail, signInWithProvider, signOut, verifyEmailCode,
} from '../lib/onlineApi.js';

const inputStyle = {
  background: C.surface, color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: 6,
  padding: '8px 10px', fontSize: 13, fontFamily: FONT, width: '100%', maxWidth: 320,
};
const row = { display: 'flex', gap: 8, flexWrap: 'wrap' };

const errText = (e) => (e instanceof Error ? e.message : String(e));

function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  async function run(fn, okText) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await fn();
      if (okText) setMessage({ tone: TONE.positive, text: okText });
      return result;
    } catch (e) {
      setMessage({ tone: TONE.concerned, text: errText(e) });
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, setMessage, run };
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [returnError] = useState(signInReturnError);
  const { busy, message, run } = useAction();

  async function sendCode(e) {
    e.preventDefault();
    const ok = await run(async () => {
      await signInWithEmail(email.trim());
      return true;
    }, 'Check your email. Enter the 6-digit code below, or open the link on this device.');
    if (ok) setSent(true);
  }

  function verify(e) {
    e.preventDefault();
    run(() => verifyEmailCode(email.trim(), code.trim()));
  }

  return (
    <Card style={{ padding: 16 }}>
      <p style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 14px', lineHeight: 1.55, maxWidth: 560 }}>
        Sign in to put your standing on the online board. Only your chosen display name and standings are shown to
        others, never your email or real name.
      </p>
      <div style={{ ...row, marginBottom: 16 }}>
        <Button variant="primary" disabled={busy} onClick={() => run(() => signInWithProvider('github'))}>
          Continue with GitHub
        </Button>
      </div>
      <form onSubmit={sendCode}>
        <Field label="No GitHub account? Use your email" htmlFor="lb-email"
          hint="We email you a 6-digit code. No password needed.">
          <div style={row}>
            <input id="lb-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" style={inputStyle} />
            <Button type="submit" disabled={busy || !email}>{sent ? 'Resend code' : 'Send code'}</Button>
          </div>
        </Field>
      </form>
      {sent && (
        <form onSubmit={verify}>
          <Field label="6-digit code" htmlFor="lb-otp">
            <div style={row}>
              <input id="lb-otp" inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="123456" style={{ ...inputStyle, maxWidth: 160, letterSpacing: 2 }} />
              <Button type="submit" variant="primary" disabled={busy || code.length < 6}>Sign in</Button>
            </div>
          </Field>
        </form>
      )}
      {returnError && <Callout tone={TONE.concerned}>Sign-in failed: {returnError}</Callout>}
      {message && <Callout tone={message.tone}>{message.text}</Callout>}
    </Card>
  );
}

function Profile({ session, profile, onSaved }) {
  const [name, setName] = useState(profile?.display_name ?? '');
  const [code, setCode] = useState('');
  const { busy, message, run } = useAction();
  const provider = session?.user?.app_metadata?.provider ?? 'your account';

  async function saveName(e) {
    e.preventDefault();
    const ok = await run(async () => { await setDisplayName(name); return true; }, 'Display name saved.');
    if (ok) onSaved();
  }

  async function submitCode(e) {
    e.preventDefault();
    const joined = await run(async () => {
      if (!(await joinClub(code))) throw new Error('That code is not right.');
      return true;
    }, 'Welcome to the club ranking.');
    if (joined) {
      setCode('');
      onSaved();
    }
  }

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <Badge label="Signed in" tone={TONE.positive} />
        <span style={{ fontSize: 13, color: C.textSecondary }}>
          {profile
            ? <>as <strong style={{ color: C.text }}>{profile.display_name}</strong>{profile.club_member ? ' · club member' : ''}</>
            : `with ${provider}. Choose a display name to appear on the board.`}
        </span>
        <Button variant="ghost" onClick={() => signOut()} style={{ marginLeft: 'auto' }}>Sign out</Button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <form onSubmit={saveName} style={{ flex: '1 1 320px' }}>
          <Field label="Display name" htmlFor="lb-name"
            hint="3-20 characters. The only thing other players see. Don't use your real name.">
            <div style={row}>
              <input id="lb-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20}
                placeholder="e.g. PacketPanda" style={inputStyle} />
              <Button type="submit" variant="primary" disabled={busy || name.trim().length < 3}>
                {profile ? 'Rename' : 'Save'}
              </Button>
            </div>
          </Field>
        </form>
      </div>
      {profile && !profile.club_member && (
        <form onSubmit={submitCode}>
          <Field label="Club code" htmlFor="lb-code"
            hint="Ask your club officers. Without it you still play and rank under Everyone.">
            <div style={row}>
              <input id="lb-code" value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} />
              <Button type="submit" disabled={busy || !code.trim()}>Join club</Button>
            </div>
          </Field>
        </form>
      )}
      {message && <Callout tone={message.tone}>{message.text}</Callout>}
    </Card>
  );
}

export default function OnlineAccount({ session, profile, onSaved }) {
  if (session === undefined) return <p style={{ fontSize: 13, color: C.textMuted }}>Checking sign-in…</p>;
  if (!session) return <SignIn />;
  // Remounting on the saved name keeps the input in step with the server.
  return <Profile key={profile?.display_name ?? 'new'} session={session} profile={profile} onSaved={onSaved} />;
}
