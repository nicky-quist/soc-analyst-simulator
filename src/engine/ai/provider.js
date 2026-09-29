// The AI Coach's connection to a model. Local-first by design: this project's
// whole point is that it runs with nothing installed, so the coach has to be
// something you opt into, not something the console depends on.
//
// Default target is Ollama on localhost — nothing leaves the machine. A cloud
// provider is offered as a fallback for anyone without a GPU to spare, and it
// is opt-in and clearly labelled: the key lives in this browser's storage only
// and is sent straight to the provider, never to anything this project runs.

const STORAGE_KEY = 'soc-sim-ai-settings';

export const PROVIDERS = {
  OFF: 'off',
  OLLAMA: 'ollama',
  CLOUD: 'cloud',
};

// qwen2.5:14b-instruct reasons about nuance (hedged language, a close
// escalation call) noticeably better than the 7-8B tier, and a debrief is one
// request per closed case, not a tight loop — the extra seconds are cheap
// compared to what a stronger model catches. 8B stays on offer for anyone
// whose hardware can't carry 14B at a usable clip.
export const OLLAMA_MODELS = [
  { id: 'qwen2.5:14b-instruct', label: 'Qwen 2.5 14B Instruct (recommended)', note: '~9GB at Q4 — best judgment for coaching text' },
  { id: 'llama3.1:8b', label: 'Llama 3.1 8B', note: 'lighter fallback if 14B is too slow on your hardware' },
  { id: 'llama3.2:3b', label: 'Llama 3.2 3B', note: 'fastest, noticeably shallower feedback' },
];

export const DEFAULT_SETTINGS = {
  provider: PROVIDERS.OFF,
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: OLLAMA_MODELS[0].id,
  cloudBaseUrl: 'https://api.anthropic.com/v1/messages',
  cloudModel: 'claude-sonnet-5-5',
  cloudApiKey: '', // never sent anywhere but the cloud provider itself
};

export function loadAiSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAiSettings(settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable — settings just won't survive a reload.
  }
}

// A cheap reachability check before committing to a generation call, so the
// UI can say "Ollama isn't running" instead of hanging on the real request.
export async function checkOllama(baseUrl, { timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, { signal: controller.signal });
    if (!res.ok) return { ok: false, models: [] };
    const data = await res.json();
    return { ok: true, models: (data.models || []).map((m) => m.name) };
  } catch {
    return { ok: false, models: [] };
  } finally {
    clearTimeout(timer);
  }
}

// Streams tokens from Ollama's /api/generate (newline-delimited JSON), calling
// onToken as each chunk arrives so the UI can render text as it's produced
// rather than waiting out the full generation in silence.
async function streamOllama({ ollamaUrl, ollamaModel }, prompt, { onToken, signal } = {}) {
  const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ollamaModel, prompt, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Ollama returned ${res.status}. Is "${ollamaModel}" pulled? Try: ollama pull ${ollamaModel}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line);
      if (chunk.response) {
        full += chunk.response;
        onToken?.(chunk.response, full);
      }
    }
  }
  return full;
}

// Cloud fallback: Anthropic Messages API, called directly from the browser
// with a key the user supplies and this app never stores anywhere but their
// own localStorage. No streaming here — kept simple since this path is the
// exception, not the default.
async function callCloud({ cloudBaseUrl, cloudModel, cloudApiKey }, prompt, { onToken, signal } = {}) {
  if (!cloudApiKey) throw new Error('No API key set for the cloud provider.');
  const res = await fetch(cloudBaseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cloudApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: cloudModel,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Cloud provider returned ${res.status}.`);
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || '').join('');
  onToken?.(text, text);
  return text;
}

// Single entry point the UI calls, regardless of which provider is active.
export async function generate(settings, prompt, opts = {}) {
  if (settings.provider === PROVIDERS.OLLAMA) return streamOllama(settings, prompt, opts);
  if (settings.provider === PROVIDERS.CLOUD) return callCloud(settings, prompt, opts);
  throw new Error('AI Coach is turned off.');
}
