// Text colors have to stay readable in both themes. This parses the real CSS
// variables out of THEME_CSS and checks WCAG AA (4.5:1) for every text color
// against every surface it is drawn on, so a palette tweak can't quietly bring
// back the low-contrast helper text this test was written to fix.

import test from 'node:test';
import assert from 'node:assert/strict';

import { THEME_CSS } from '../src/theme.js';

function variablesFor(selector) {
  const start = THEME_CSS.indexOf(selector);
  const open = THEME_CSS.indexOf('{', start);
  const close = THEME_CSS.indexOf('\n}', open);
  const block = THEME_CSS.slice(open + 1, close);
  const vars = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) vars[m[1]] = m[2];
  return vars;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ['surface', 'surface-alt', 'bg'];
// Text colors used at small sizes. `primary` is a fill and border colour; the
// text version of it is `primary-strong`.
const TEXT = ['text', 'text-secondary', 'text-muted', 'primary-strong', 'success', 'warning', 'danger', 'info'];

const THEMES = {
  light: variablesFor(':root, [data-theme="light"]'),
  dark: variablesFor('[data-theme="dark"]'),
};

test('both themes define every color the check depends on', () => {
  for (const [name, vars] of Object.entries(THEMES)) {
    for (const key of [...SURFACES, ...TEXT]) assert.ok(vars[key], `${name} theme is missing --${key}`);
  }
});

for (const [name, vars] of Object.entries(THEMES)) {
  test(`${name} theme: every text color meets AA contrast on every surface`, () => {
    for (const text of TEXT) {
      for (const surface of SURFACES) {
        const ratio = contrast(vars[text], vars[surface]);
        assert.ok(ratio >= 4.5, `${name}: --${text} on --${surface} is ${ratio.toFixed(2)}:1, needs 4.5`);
      }
    }
  });

  test(`${name} theme: severity text is readable on its own tinted background`, () => {
    for (const level of ['critical', 'high', 'medium', 'low', 'informational']) {
      const fg = vars[`sev-${level}`];
      const bg = vars[`sev-${level}-bg`];
      assert.ok(fg && bg, `${name}: severity ${level}`);
      const ratio = contrast(fg, bg);
      assert.ok(ratio >= 4.5, `${name}: severity ${level} is ${ratio.toFixed(2)}:1`);
    }
  });
}

test('muted text stays visibly quieter than body text (the hierarchy survives the fix)', () => {
  for (const [name, vars] of Object.entries(THEMES)) {
    assert.ok(contrast(vars['text-muted'], vars.surface) < contrast(vars.text, vars.surface), name);
    assert.ok(contrast(vars['text-muted'], vars.surface) <= contrast(vars['text-secondary'], vars.surface), name);
  }
});
