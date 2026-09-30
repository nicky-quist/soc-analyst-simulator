// The hands-on step of a Red Ops stage. It unlocks only after the analyst picks
// the canonical move, and it is a SIMULATION, not a shell: nothing the user
// types is executed, ever. The engine checks the typed command against an
// authored set of expected tokens and, on a match, prints authored output —
// exactly the way the Investigate tab returns canned search results. The point
// is defensive: see the command's shape, then read the telemetry it generates
// and what the SOC logs. The authored samples are illustrative and defanged
// (placeholders like <encoded_blob>, not runnable payloads) on purpose.

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// A stage's handsOn matches when every token in `expect` appears in the typed
// command (order-independent, case-insensitive). Tokens are matched as
// substrings so "get-adcomputer" matches whether or not the user added flags.
export function matchHandsOn(handsOn, input) {
  if (!handsOn) return { status: 'none' };
  const text = normalize(input);
  if (!text) return { status: 'empty', hint: handsOn.hint ?? '' };

  const expected = (handsOn.expect ?? []).map(normalize).filter(Boolean);
  const hit = expected.every((token) => text.includes(token));

  if (hit) {
    return {
      status: 'match',
      output: handsOn.output ?? [],
      soc: handsOn.soc ?? '',
      sample: handsOn.sample ?? '',
    };
  }

  return {
    status: 'miss',
    miss: handsOn.miss ?? 'That is not the command this stage is looking for. Re-read the hint.',
    hint: handsOn.hint ?? '',
  };
}

// True when a stage offers a hands-on step at all, so the view can decide
// whether to render the console.
export function hasHandsOn(stage) {
  return !!(stage && stage.handsOn && Array.isArray(stage.handsOn.expect) && stage.handsOn.expect.length);
}
