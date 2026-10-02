// Secrets host

import { useCallback, useEffect, useRef, useState } from 'react';
import { EGG_BY_ID, EGGS, REPO_URL } from '../data/easterEggs.js';
import { FAST_ALERTS } from '../data/fasttriage.js';
import { RED_OPS } from '../data/redops.js';
import { SCENARIOS } from '../data/scenarios/index.js';
import { announce, createKonami, subscribe } from '../engine/easterEggs.js';
import { loadFound, saveFound, unlock } from '../engine/easterEggsStore.js';
import { C, FONT, MONO } from '../theme.js';
import { Button } from '../ui/primitives.jsx';
import { useDialogFocus } from '../ui/useDialogFocus.js';
import { IconSparkles, IconX } from '../ui/icons.jsx';

const TOAST_MS = 8000;

function Toast({ egg, foundCount, onClose }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 900, maxWidth: 360, width: 'calc(100vw - 32px)',
        background: C.surface, color: C.text, border: `1px solid ${C.primary}`, borderRadius: 10,
        boxShadow: C.shadowLg, padding: '12px 14px', fontFamily: FONT,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: C.primaryStrong, display: 'flex' }}><IconSparkles size={14} /></span>
        <strong style={{ fontSize: 12.5, flex: 1 }}>Secret found: {egg.title}</strong>
        <button
          type="button" onClick={onClose} aria-label="Dismiss"
          style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 2, display: 'flex' }}
        >
          <IconX size={13} />
        </button>
      </div>
      {egg.from && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>{egg.from}</div>}
      <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55 }}>{egg.message}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{foundCount} of {EGGS.length} found</div>
    </div>
  );
}

function Overlay({ children, label, onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useDialogFocus(dialogRef, onClose, closeRef);

  return (
    <div
      ref={dialogRef}
      role="dialog" aria-modal="true" aria-label={label}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480 }}>
        {children}
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Button variant="secondary" onClick={onClose} ref={closeRef}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function Terminal({ stats, found }) {
  const lines = [
    ['> whoami', 'analyst'],
    ['> rank --blue --red', `Blue: ${stats.blueRank}\nRed:  ${stats.redRank}`],
    ['> cases --closed', `${stats.closed} closed this shift`],
    ['> secrets --found', `${found} of ${EGGS.length}`],
    ['> exit', ''],
  ];
  return (
    <pre style={{
      margin: 0, padding: 18, borderRadius: 8, background: '#0b0f0c', color: '#7CFC98',
      fontFamily: MONO, fontSize: 13, lineHeight: 1.6, border: '1px solid #1c2a20', whiteSpace: 'pre-wrap',
    }}>
      {lines.map(([cmd, out]) => `${cmd}\n${out ? `${out}\n` : ''}`).join('')}
    </pre>
  );
}

function Credits({ found }) {
  return (
    <div style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: 22, fontFamily: FONT, boxShadow: C.shadowLg }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
        Behind the console
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>SEA SOC Analyst Console</div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>Built by <strong>Nicholas Quist</strong>.</div>
      <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.7, marginBottom: 14 }}>
        {SCENARIOS.length} scenarios · {Object.keys(RED_OPS).length} Red Ops operations · {FAST_ALERTS.length} Fast Triage cards<br />
        Secrets found: {found} of {EGGS.length}
      </div>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" style={{ color: C.primaryStrong, fontSize: 13, fontWeight: 600 }}>
        Source on GitHub
      </a>
    </div>
  );
}

export default function EggHost({ stats }) {
  const [found, setFound] = useState(loadFound);
  const [toast, setToast] = useState(null);
  // Read #credits first
  const [overlay, setOverlay] = useState(() => (
    typeof window !== 'undefined' && window.location.hash === '#credits' ? 'credits' : null
  ));
  const foundRef = useRef(found);
  const toastTimer = useRef(null);

  useEffect(() => { foundRef.current = found; }, [found]);

  const handle = useCallback(({ id, type }) => {
    if (type === 'reset') {
      setFound(loadFound());
      return;
    }
    const egg = EGG_BY_ID[id];
    if (!egg) return;
    const { found: next, isNew } = unlock(foundRef.current, id);
    if (isNew) {
      foundRef.current = next;
      setFound(next);
      saveFound(next);
    }
    if (egg.kind === 'overlay') {
      setOverlay(id);
    } else if (isNew) {
      setToast(egg);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
    }
  }, []);

  useEffect(() => {
    const off = subscribe(handle);
    return () => { off(); clearTimeout(toastTimer.current); };
  }, [handle]);

  // Konami code
  useEffect(() => {
    const push = createKonami();
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (push(e.key)) announce('konami');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // #credits link
  useEffect(() => {
    const check = () => { if (window.location.hash === '#credits') announce('credits'); };
    if (window.location.hash === '#credits') announce('credits');
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const closeOverlay = useCallback(() => {
    setOverlay(null);
    if (window.location.hash === '#credits') window.history.replaceState(null, '', '#dashboard');
  }, []);

  return (
    <>
      {toast && <Toast egg={toast} foundCount={found.length} onClose={() => setToast(null)} />}
      {overlay === 'konami' && (
        <Overlay label="The old code" onClose={closeOverlay}><Terminal stats={stats} found={found.length} /></Overlay>
      )}
      {overlay === 'credits' && (
        <Overlay label="Behind the console" onClose={closeOverlay}><Credits found={found.length} /></Overlay>
      )}
    </>
  );
}
