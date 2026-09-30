import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { matchHandsOn, hasHandsOn } from '../src/engine/redHandsOn.js';
import { RED_OPS } from '../src/data/redops.js';

const handsOn = {
  prompt: 'p',
  hint: 'h',
  expect: ['powershell', '-enc'],
  sample: 'powershell.exe -enc <blob>',
  output: ['line one', 'line two'],
  soc: 'what the soc logs',
  miss: 'not this one',
};

describe('matchHandsOn', () => {
  test('matches when every expected token is present, order-independent', () => {
    const r = matchHandsOn(handsOn, '-enc <blah> powershell.exe -nop');
    assert.equal(r.status, 'match');
    assert.deepEqual(r.output, ['line one', 'line two']);
    assert.equal(r.soc, 'what the soc logs');
  });

  test('is case-insensitive and ignores quotes and extra whitespace', () => {
    assert.equal(matchHandsOn(handsOn, "  PowerShell   -ENC  'x' ").status, 'match');
  });

  test('misses when a required token is absent', () => {
    const r = matchHandsOn(handsOn, 'powershell.exe -nop -w hidden');
    assert.equal(r.status, 'miss');
    assert.equal(r.miss, 'not this one');
  });

  test('reports empty input rather than a miss', () => {
    assert.equal(matchHandsOn(handsOn, '   ').status, 'empty');
  });

  test('returns none when the stage has no hands-on block', () => {
    assert.equal(matchHandsOn(undefined, 'anything').status, 'none');
  });

  test('never executes or echoes the input back as a command', () => {
    const r = matchHandsOn(handsOn, 'powershell -enc rm -rf /');
    assert.equal(r.status, 'match');
    // Output is authored, not derived from what the user typed.
    assert.ok(!r.output.join('\n').includes('rm -rf'));
  });
});

describe('hasHandsOn', () => {
  test('true only for a stage with a non-empty expect list', () => {
    assert.equal(hasHandsOn({ handsOn }), true);
    assert.equal(hasHandsOn({ handsOn: { expect: [] } }), false);
    assert.equal(hasHandsOn({}), false);
    assert.equal(hasHandsOn(null), false);
  });
});

describe('every Red Ops operation wires up its hands-on steps correctly', () => {
  const allStages = Object.entries(RED_OPS).flatMap(([opId, ops]) =>
    ops.stages.map((stage) => [`${opId}/${stage.id}`, stage]));
  const withHandsOn = allStages.filter(([, stage]) => hasHandsOn(stage));

  test('every operation carries at least one hands-on step', () => {
    for (const [opId, ops] of Object.entries(RED_OPS)) {
      assert.ok(ops.stages.some(hasHandsOn), `${opId} needs at least one hands-on stage`);
    }
  });

  test('a hands-on step only sits on a stage that has a canonical choice', () => {
    for (const [id, stage] of withHandsOn) {
      assert.ok(stage.choices.some((c) => c.canonical), `${id} needs a canonical choice`);
    }
  });

  test('every hands-on step has a sample, output, a soc line and a miss message', () => {
    for (const [id, stage] of withHandsOn) {
      assert.ok(stage.handsOn.sample, `${id} sample`);
      assert.ok(stage.handsOn.output.length > 0, `${id} output`);
      assert.ok(stage.handsOn.soc, `${id} soc`);
      assert.ok(stage.handsOn.miss, `${id} miss`);
    }
  });

  test('the authored sample for each stage actually satisfies its own matcher', () => {
    for (const [id, stage] of withHandsOn) {
      const r = matchHandsOn(stage.handsOn, stage.handsOn.sample);
      assert.equal(r.status, 'match', `${id} sample should match its own expect tokens`);
    }
  });

  test('samples use defanged placeholders, never a real-looking secret or IP', () => {
    for (const [id, stage] of withHandsOn) {
      // No dotted-quad IPv4 literal in the authored sample command.
      assert.ok(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(stage.handsOn.sample), `${id} sample should not carry a literal IP`);
    }
  });
});
