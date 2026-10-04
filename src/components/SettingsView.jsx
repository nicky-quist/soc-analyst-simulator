// Settings

import { useState } from 'react';
import { C, TONE } from '../theme.js';
import { Button, Callout, Card } from '../ui/primitives.jsx';
import { IconSparkles } from '../ui/icons.jsx';
import { announce } from '../engine/easterEggs.js';
import { clearFound, loadFound } from '../engine/easterEggsStore.js';
import { loadAiSettings, PROVIDERS, saveAiSettings } from '../engine/ai/provider.js';
import { SettingsPanel } from './AiCoach.jsx';
import SecretHints from './SecretHints.jsx';

// One section: icon + title + what it is, then its controls
function Section({ icon, title, description, children }) {
  return (
    <Card style={{ padding: 18, marginBottom: 16, maxWidth: 820 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: C.primaryStrong, display: 'flex' }}>{icon}</span>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: C.text }}>{title}</h2>
      </div>
      <p style={{ fontSize: 12.5, color: C.textSecondary, margin: '0 0 14px', lineHeight: 1.55, maxWidth: 700 }}>{description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </Card>
  );
}

// Found secrets
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
    <Section
      icon={<IconSparkles size={16} />}
      title="Secrets"
      description="There are things hidden in this console. They never affect a grade, a rank or your history, and Reset everything leaves them alone."
    >
      <SecretHints found={found} />
      {!confirming ? (
        <div>
          <Button variant="ghost" onClick={() => setConfirming(true)} disabled={!found.length}>Forget found secrets</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Forget all {found.length} you have found?</span>
          <Button variant="danger" onClick={forget}>Forget them</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      )}
    </Section>
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

      <Section
        icon={<IconSparkles size={16} />}
        title="AI Coach"
        description="An optional second, LLM-generated debrief on a closed case, alongside (never instead of) the deterministic CISO and CEO responses. Off by default, and nothing leaves your machine unless you turn on the cloud option yourself."
      >
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
      </Section>

      <Secrets />
    </div>
  );
}
