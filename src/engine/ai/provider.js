// AI provider (Ollama or cloud)

import { readStored, writeStored } from '../localStore.js';

const STORAGE_KEY = 'soc-sim-ai-settings';

export const PROVIDERS = {
  OFF: 'off',
  OLLAMA: 'ollama',
  CLOUD: 'cloud',
};

// Ollama models
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
  return readStored(STORAGE_KEY, DEFAULT_SETTINGS, (parsed) => (parsed ? { ...DEFAULT_SETTINGS, ...parsed } : null));
}

export const saveAiSettings = (settings) => writeStored(STORAGE_KEY, settings);

// Ollama reachability check
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

// Ollama streaming
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

// Cloud fallback
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

// Provider entry point
export async function generate(settings, prompt, opts = {}) {
  if (settings.provider === PROVIDERS.OLLAMA) return streamOllama(settings, prompt, opts);
  if (settings.provider === PROVIDERS.CLOUD) return callCloud(settings, prompt, opts);
  throw new Error('AI Coach is turned off.');
}
