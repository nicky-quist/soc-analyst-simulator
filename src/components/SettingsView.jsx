// A findable home for app-wide settings. The AI Coach was previously only
// discoverable by closing a case and scrolling its Debrief tab — this gives
// it (and anything added later) a permanent, always-visible spot.

import { useState } from 'react';
import { C, TONE } from '../theme.js';
import { Badge, Button, Callout, Card, SectionLabel } from '../ui/primitives.jsx';
import { IconSparkles } from '../ui/icons.jsx';
import { EGGS } from '../data/easterEggs.js';
import { announce } from '../engine/easterEggs.js';
import { clearFound, loadFound } from '../engine/easterEggsStore.js';
import { loadAiSettings, PROVIDERS, saveAiSettings } from '../engine/ai/provider.js';
import { SettingsPanel } from './AiCoach.jsx';

// Found secrets, with the rest shown as ??? and never explained. Reset
// everything does not touch these; this button is the only way to forget them.
function Secrets() {
  const [found, setFound] = useState(loadFound);
  const [confirming, setConfirming] = useState(false);

  function forget() {
    clearFound();
    setFound([]);
    setConfirming(false);
    announce(null, 'reset');
  }

  return (
    <div style={{ marginTop: 28 }}>
      <SectionLabel icon={<IconSparkles size={13} />}>Secrets</SectionLabel>
      <p style={{ fontSize: 12.5, color: C.textSecondary, margin: '0 0 12px', lineHeight: 1.55, maxWidth: 700 }}>
        There are things hidden in this console. Found {found.length} of {EGGS.length}. They never affect a grade, a rank or
        your history, and Reset everything leaves them alone.
      </p>
      <Card style={{ padding: 14, marginBottom: 12 }}>
        {EGGS.map((egg) => {
          const isFound = found.includes(egg.id);
          return (
            <div key={egg.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', fontSize: 12.5, flexWrap: 'wrap' }}>
              <Badge label={isFound ? 'Found' : '???'} tone={isFound ? TONE.positive : TONE.neutral} />
              <span style={{ color: isFound ? C.text : C.textMuted, fontWeight: isFound ? 600 : 400 }}>
                {isFound ? egg.title : 'Not found yet'}
              </span>
            </div>
          );
        })}
      </Card>
      {!confirming ? (
        <Button variant="ghost" onClick={() => setConfirming(true)} disabled={!found.length}>Forget found secrets</Button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Forget all {found.length} you have found?</span>
          <Button variant="danger" onClick={forget}>Forget them</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

export default function SettingsView() {
  const [settings, setSettings] = useState(loadAiSettings);

  function updateSettings(next) {
    setSettings(next);
    saveAiSettings(next);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Settings</h1>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 18px', lineHeight: 1.55, maxWidth: 760 }}>
        Saved to this browser only. Changes apply the next time you open a case's Debrief tab.
      </p>

      <SectionLabel icon={<IconSparkles size={13} />}>AI Coach</SectionLabel>
      <p style={{ fontSize: 12.5, color: C.textSecondary, margin: '0 0 12px', lineHeight: 1.55, maxWidth: 700 }}>
        An optional second, LLM-generated debrief on a closed case, alongside (never instead of) the deterministic
        CISO and CEO responses. Off by default, and nothing leaves your machine unless you turn on the cloud option
        yourself.
      </p>

      <SettingsPanel settings={settings} onChange={updateSettings} />

      {settings.provider === PROVIDERS.OFF ? (
        <Callout tone={TONE.neutral}>
          AI Coach is off. Turn it on above — a local Ollama model is recommended, since nothing leaves your machine.
          Once it's on, close any case and look for it on the Debrief tab.
        </Callout>
      ) : (
        <Callout tone={TONE.positive}>
          AI Coach is on ({settings.provider === PROVIDERS.OLLAMA ? 'local Ollama' : 'cloud, bring your own key'}).
          Close a case and open its Debrief tab to get a debrief from it.
        </Callout>
      )}

      <Secrets />
    </div>
  );
}
