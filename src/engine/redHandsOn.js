// Red Ops hands-on step (simulated)

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Command match
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

// Has a hands-on step?
export function hasHandsOn(stage) {
  return !!(stage && stage.handsOn && Array.isArray(stage.handsOn.expect) && stage.handsOn.expect.length);
}
