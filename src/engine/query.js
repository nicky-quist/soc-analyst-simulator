// A deliberately small SIEM search language, modeled on the shape of SPL /
// KQL rather than any one product: `index=auth src_ip=185.220.101.45`.
//
// The point of this module is that the analyst has to produce the correct
// indicator themselves. Nothing is clickable — if you mistype an octet, search
// the wrong index, or leave the time picker on its 15-minute default (which is
// where a real console starts you), you get zero events back and have to work
// out why. Those three are the most common ways a new analyst loses an hour.

export const TIME_RANGES = [
  { id: '15m', label: 'Last 15 minutes', minutes: 15 },
  { id: '1h', label: 'Last 1 hour', minutes: 60 },
  { id: '4h', label: 'Last 4 hours', minutes: 240 },
  { id: '24h', label: 'Last 24 hours', minutes: 1440 },
  { id: '7d', label: 'Last 7 days', minutes: 10080 },
  { id: '30d', label: 'Last 30 days', minutes: 43200 },
];

export const DEFAULT_RANGE = '15m';

const INDEX_KEYS = new Set(['index', 'source', 'sourcetype', 'datasource', 'log']);

// Threat feeds and tickets hand analysts "defanged" indicators so they can't be
// clicked by accident. Pasting one into a search bar is normal; the console
// should understand it rather than silently return nothing.
export function refang(value) {
  return String(value)
    .trim()
    .replace(/\[\.\]|\(\.\)|\{\.\}/g, '.')
    .replace(/\[:\]|\(:\)/g, ':')
    .replace(/\bhxxp(s?):/gi, 'http$1:')
    .replace(/\[at\]/gi, '@');
}

function normalize(value) {
  return refang(value).toLowerCase().replace(/^["']|["'],?$/g, '').replace(/[.,;]$/, '');
}

// Splits on whitespace but keeps "quoted phrases" together.
export function parseQuery(input) {
  const tokens = String(input).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const pairs = {};
  const terms = [];
  let index = null;

  for (const token of tokens) {
    const match = token.match(/^([a-zA-Z_][\w.]*)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1].toLowerCase();
      const value = normalize(match[2]);
      if (INDEX_KEYS.has(key)) index = value;
      else pairs[key] = value;
    } else {
      const bare = normalize(token);
      if (bare) terms.push(bare);
    }
  }

  return {
    raw: String(input).trim(),
    index,
    pairs,
    terms,
    // Every value the analyst actually typed, whether as a field or a bare term.
    values: [...Object.values(pairs), ...terms],
  };
}

function rangeMinutes(rangeId) {
  return TIME_RANGES.find((r) => r.id === rangeId)?.minutes ?? 15;
}

function rangeLabel(rangeId) {
  return TIME_RANGES.find((r) => r.id === rangeId)?.label ?? rangeId;
}

// A term is satisfied when the analyst typed it exactly, or typed something
// that contains it (so `src_ip=185.220.101.45` and a bare paste both work).
function hasTerm(query, term) {
  const needle = normalize(term);
  return query.values.some((value) => value === needle || value.includes(needle));
}

function matchesTerms(query, search) {
  const required = search.match.terms || [];
  return required.every((term) => hasTerm(query, term));
}

function indexesFor(scenario) {
  return (scenario.datasets || []).map((d) => d.index);
}

export function runQuery(scenario, rawInput, rangeId = DEFAULT_RANGE) {
  const query = parseQuery(rawInput);
  const available = indexesFor(scenario);

  if (!query.raw) {
    return { status: 'error', title: 'Empty search', detail: 'Enter a search — for example `index=auth 10.0.0.1`.' };
  }

  if (query.index && !available.includes(query.index)) {
    return {
      status: 'error',
      title: `Unknown index "${query.index}"`,
      detail: `No such data source is onboarded. Available: ${available.join(', ')}.`,
      query,
    };
  }

  if (!query.values.length) {
    return {
      status: 'error',
      title: 'No search terms',
      detail: 'An index alone matches everything. Add the value you are hunting for — a host, a user, an IP.',
      query,
    };
  }

  const candidates = (scenario.searches || []).filter((s) => matchesTerms(query, s));

  // The terms are right but the analyst is looking in the wrong data source.
  const wrongIndex = candidates.find((s) => query.index && s.match.index && s.match.index !== query.index);
  const match = candidates.find((s) => !query.index || !s.match.index || s.match.index === query.index);

  if (!match) {
    if (wrongIndex) {
      return {
        status: 'empty',
        title: '0 events',
        detail: `Nothing in index "${query.index}" matches that.`,
        hint: `That value exists in this environment — you are searching the wrong data source. Available: ${available.join(', ')}.`,
        query,
      };
    }
    return {
      status: 'empty',
      title: '0 events',
      detail: `No events match ${query.values.map((v) => `"${v}"`).join(' ')} in ${rangeLabel(rangeId).toLowerCase()}.`,
      hint: 'Check the indicator character by character against the alert, and confirm you are searching the right index.',
      query,
    };
  }

  // Right search, window too narrow — the classic "the console defaulted to 15
  // minutes and the activity was overnight" miss.
  const needed = match.needsWindow || 0;
  if (needed > rangeMinutes(rangeId)) {
    return {
      status: 'empty',
      searchId: match.id,
      title: '0 events',
      detail: `No events in ${rangeLabel(rangeId).toLowerCase()}.`,
      hint: 'The search itself is right. This activity is older than your time range — widen the time picker and run it again.',
      query,
    };
  }

  return {
    status: 'ok',
    searchId: match.id,
    label: match.label,
    index: match.match.index || query.index || 'all',
    columns: match.columns,
    events: match.events,
    note: match.note,
    scoped: !!query.index,
    query,
  };
}
