// Optional AI debrief coach: a second, LLM-generated lens on a closed case,
// alongside (never instead of) the deterministic CISO debrief in personas.js.
// Off by default. Talks to a local Ollama instance unless the analyst opts
// into a cloud key themselves.

import { useEffect, useRef, useState } from 'react';
import { C, TONE } from '../theme.js';
import { Button, Callout, Card, Field, SectionLabel } from '../ui/primitives.jsx';
import { IconSparkles } from '../ui/icons.jsx';
import {
  checkOllama, DEFAULT_SETTINGS, loadAiSettings, OLLAMA_MODELS, PROVIDERS, saveAiSettings,
} from '../engine/ai/provider.js';
import { generateCoachDebrief } from '../engine/ai/coach.js';

const STATUS = { IDLE: 'idle', CHECKING: 'checking', READY: 'ready', UNREACHABLE: 'unreachable', STREAMING: 'streaming', ERROR: 'error' };

export function SettingsPanel({ settings, onChange }) {
  return (
    <Card style={{ padding: 16, marginBottom: 14 }}>
      <Field label="Provider">
        <select
          value={settings.provider}
          onChange={(e) => onChange({ ...settings, provider: e.target.value })}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}
        >
          <option value={PROVIDERS.OFF}>Off</option>
          <option value={PROVIDERS.OLLAMA}>Local — Ollama (recommended, nothing leaves your machine)</option>
          <option value={PROVIDERS.CLOUD}>Cloud — bring your own API key</option>
        </select>
      </Field>

      {settings.provider === PROVIDERS.OLLAMA && (
        <>
          <Field label="Ollama URL">
            <input
              value={settings.ollamaUrl}
              onChange={(e) => onChange({ ...settings, ollamaUrl: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}
            />
          </Field>
          <Field label="Model" hint="Pull it first: ollama pull <model>">
            <select
              value={settings.ollamaModel}
              onChange={(e) => onChange({ ...settings, ollamaModel: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}
            >
              {OLLAMA_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
        </>
      )}

      {settings.provider === PROVIDERS.CLOUD && (
        <>
          <Callout tone={TONE.neutral} style={{ marginBottom: 14 }}>
            Your key is stored only in this browser's local storage and sent directly to the provider — this project never sees it or stores it anywhere else.
          </Callout>
          <Field label="API key">
            <input
              type="password"
              value={settings.cloudApiKey}
              onChange={(e) => onChange({ ...settings, cloudApiKey: e.target.value })}
              placeholder="sk-ant-..."
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}
            />
          </Field>
          <Field label="Model">
            <input
              value={settings.cloudModel}
              onChange={(e) => onChange({ ...settings, cloudModel: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}
            />
          </Field>
        </>
      )}
    </Card>
  );
}

export default function AiCoach({ scenario, submission, score, timeline }) {
  const [settings, setSettings] = useState(loadAiSettings);
  const [showSettings, setShowSettings] = useState(settings.provider === DEFAULT_SETTINGS.provider);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  function updateSettings(next) {
    setSettings(next);
    saveAiSettings(next);
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runCoach() {
    setText('');
    setError(null);

    if (settings.provider === PROVIDERS.OLLAMA) {
      setStatus(STATUS.CHECKING);
      const check = await checkOllama(settings.ollamaUrl);
      if (!check.ok) {
        setStatus(STATUS.UNREACHABLE);
        return;
      }
    }

    setStatus(STATUS.STREAMING);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await generateCoachDebrief(settings, scenario, submission, score, timeline, {
        signal: controller.signal,
        onToken: (_chunk, full) => setText(full),
      });
      setStatus(STATUS.READY);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'The AI coach failed to respond.');
      setStatus(STATUS.ERROR);
    }
  }

  if (settings.provider === PROVIDERS.OFF && !showSettings) {
    return (
      <Card style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary }}>
            <IconSparkles size={15} />
            AI Coach is off — an optional second debrief from a local or your own cloud model.
          </div>
          <Button variant="ghost" onClick={() => setShowSettings(true)}>Set up</Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel icon={<IconSparkles size={13} />} style={{ marginBottom: 0 }}>AI Coach {settings.provider === PROVIDERS.OLLAMA ? '(local)' : settings.provider === PROVIDERS.CLOUD ? '(cloud)' : ''}</SectionLabel>
        <Button variant="ghost" onClick={() => setShowSettings((v) => !v)}>{showSettings ? 'Hide settings' : 'Settings'}</Button>
      </div>

      {showSettings && <SettingsPanel settings={settings} onChange={updateSettings} />}

      {settings.provider !== PROVIDERS.OFF && (
        <Card style={{ padding: 18 }}>
          {status === STATUS.IDLE && (
            <Button variant="primary" onClick={runCoach}>
              <IconSparkles size={14} /> Get an AI debrief on this case
            </Button>
          )}

          {status === STATUS.CHECKING && (
            <div style={{ fontSize: 13, color: C.textSecondary }}>Checking for Ollama at {settings.ollamaUrl}…</div>
          )}

          {status === STATUS.UNREACHABLE && (
            <Callout tone={TONE.coaching} title="Couldn't reach Ollama">
              Make sure it's running (<code>ollama serve</code>) and the model is pulled (<code>ollama pull {settings.ollamaModel}</code>), then try again.
              <div style={{ marginTop: 10 }}><Button onClick={runCoach}>Retry</Button></div>
            </Callout>
          )}

          {status === STATUS.ERROR && (
            <Callout tone={TONE.concerned} title="AI coach couldn't respond">
              {error}
              <div style={{ marginTop: 10 }}><Button onClick={runCoach}>Retry</Button></div>
            </Callout>
          )}

          {(status === STATUS.STREAMING || status === STATUS.READY) && (
            <>
              <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                {text || 'Thinking…'}
                {status === STATUS.STREAMING && <span style={{ opacity: 0.5 }}>▌</span>}
              </div>
              {status === STATUS.READY && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <Button variant="ghost" onClick={runCoach}>Regenerate</Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
