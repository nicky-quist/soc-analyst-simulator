// How you are doing across shifts, not just tonight.
//
// A shift grades seven cases and then forgets them. That's fine for a single
// sitting, but it can't answer the question a trainee actually has: what do I
// keep getting wrong? This keeps a record of every case you close, breaks each
// one into the individual calls the grader already makes, and turns a
// consistent weakness into a nudge on the next shift's deal.
//
// Three rules keep the record honest:
//
//   * First attempts only. A retry comes after the debrief has shown you the
//     answer, so counting it would measure recall of the debrief, not skill.
//   * Learn mode excludes a case. Opening the walkthrough means the evidence
//     was pointed out rather than found.
//   * One miss is not a weakness. Rates are smoothed toward 50% and a skill
//     needs several attempts before it can be named, so the sim doesn't
//     reshape your next shift around a single bad case.

import { SEVERITY_ORDER, isResolvedCorrectly, overEscalated, underEscalated } from './scoring.js';

export const HISTORY_LIMIT = 500;
export const MIN_ATTEMPTS = 4;      // attempts before a skill can be called weak
export const WEAK_BELOW = 0.75;     // smoothed success rate that counts as weak
export const RECENT_WINDOW = 5;     // cases compared against everything before them
export const MAX_WEIGHT = 4;        // no scenario is ever more than 4x as likely as another

// Each skill is one decision the grader already scores. `null` means the case
// had nothing to test for that skill (no report points, no response target),
// which is different from getting it wrong.
export const SKILLS = [
  { id: 'classification', label: 'Classification', test: (s) => s.classificationCorrect },
  { id: 'escalation', label: 'Escalation', test: (s) => s.escalationCorrect },
  { id: 'severity', label: 'Severity', test: (s) => s.severityCorrect },
  { id: 'mitre', label: 'ATT&CK mapping', test: (s) => s.mitreCorrect },
  {
    id: 'investigation', label: 'Investigation coverage',
    test: (s) => (s.investigation.requiredCount ? s.investigation.coverage === 1 : null),
  },
  {
    id: 'response', label: 'Response actions',
    test: (s) => s.response.harmful.length === 0 && s.response.missing.length === 0,
  },
  { id: 'report', label: 'Report', test: (s) => (s.scorableCount ? s.matchedCount === s.scorableCount : null) },
  { id: 'sla', label: 'Response time', test: (s) => s.withinResponseTarget ?? null },
];

const skillById = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function emptyProgress() {
  return { history: [], adaptive: true };
}

export function caseKey(shiftStartedAt, deal, scenarioId) {
  return `${shiftStartedAt}:${deal}:${scenarioId}`;
}

// A closed case, reduced to what the record needs. The full score stays in the
// shift's own storage; this has to stay small because it outlives every shift.
export function buildRecord({ scenario, submission, score, attempt, closedAt, shiftStartedAt, deal }) {
  return {
    key: caseKey(shiftStartedAt, deal, scenario.id),
    scenarioId: scenario.id,
    closedAt,
    attempt,
    assisted: !!score.assisted,
    overallScore: score.overallScore,
    resolved: isResolvedCorrectly(score),
    outcomes: Object.fromEntries(SKILLS.map((skill) => [skill.id, skill.test(score)])),
    escalation: underEscalated(scenario, submission) ? 'under' : overEscalated(scenario, submission) ? 'over' : 'correct',
  };
}

// Returns { progress, recorded, reason } so the caller can tell the analyst why
// a case didn't count, instead of it silently vanishing from their stats.
export function recordCase(progress, record) {
  if (record.attempt !== 1) return { progress, recorded: false, reason: 'retry' };
  if (record.assisted) return { progress, recorded: false, reason: 'assisted' };
  if (progress.history.some((r) => r.key === record.key)) return { progress, recorded: false, reason: 'duplicate' };
  const history = [...progress.history, record].slice(-HISTORY_LIMIT);
  return { progress: { ...progress, history }, recorded: true, reason: null };
}

// Laplace smoothing: one miss from one attempt reads as 33%, not 0%.
export function smoothedRate(correct, attempts) {
  return (correct + 1) / (attempts + 2);
}

function rate(values) {
  return values.length ? values.filter(Boolean).length / values.length : null;
}

export function skillSummary(history) {
  return SKILLS.map((skill) => {
    const outcomes = history.map((r) => r.outcomes[skill.id]).filter((v) => v === true || v === false);
    const correct = outcomes.filter(Boolean).length;
    const recent = outcomes.slice(-RECENT_WINDOW);
    const earlier = outcomes.slice(0, -RECENT_WINDOW);
    // A trend needs something on both sides of the line to compare.
    const trend = earlier.length >= 3 && recent.length >= 3 ? rate(recent) - rate(earlier) : null;
    return {
      id: skill.id,
      label: skill.label,
      attempts: outcomes.length,
      correct,
      rate: rate(outcomes),
      smoothed: smoothedRate(correct, outcomes.length),
      trend,
    };
  });
}

export function weakestSkill(summary) {
  const candidates = summary.filter((s) => s.attempts >= MIN_ATTEMPTS && s.smoothed < WEAK_BELOW);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => a.smoothed - b.smoothed || b.attempts - a.attempts)[0];
}

export function escalationTendency(history) {
  const under = history.filter((r) => r.escalation === 'under').length;
  const over = history.filter((r) => r.escalation === 'over').length;
  const decided = history.length;
  const direction = under + over < 2 || under === over ? null : under > over ? 'under' : 'over';
  return { under, over, correct: decided - under - over, total: decided, direction };
}

// Which failures happened on which scenario, so a scenario you got wrong can
// come back.
function missesByScenario(history, skillId) {
  const misses = {};
  for (const r of history) {
    if (r.outcomes[skillId] === false) misses[r.scenarioId] = (misses[r.scenarioId] || 0) + 1;
  }
  return misses;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Each rule answers: given this weakness, which scenarios practise it, and
// why? Every boost carries a reason, because a trainee who can't see why the
// queue looks the way it does will assume it's random.
function targetedBoost(skillId, scenario, context) {
  const { truth, alert } = scenario;

  // Most of the library needs escalating, so "deal more cases that need
  // escalating" barely changes a hand. What trips an under-escalator is a case
  // that doesn't *look* like it needs it: an alert reported well below its
  // real severity. Weight by how far the alert undersells the case.
  if (skillId === 'escalation' && context.tendency.direction === 'under' && truth.escalation.startsWith('escalate_')) {
    const understated = SEVERITY_ORDER.indexOf(truth.severity) - SEVERITY_ORDER.indexOf(alert.reportedSeverity);
    if (understated > 0) {
      const where = truth.escalation === 'escalate_ir' ? 'IR' : 'Tier 2';
      return { factor: 1 + 1.5 * understated, why: `arrives as ${alert.reportedSeverity} but is ${truth.severity} and has to go to ${where}` };
    }
  }
  if (skillId === 'escalation' && context.tendency.direction === 'over' && truth.escalation.startsWith('close_')) {
    return { factor: 3, why: 'should be closed, not escalated' };
  }
  // Nearly every alert's reported severity is off by one step, so a one-step
  // gap targets almost the whole library. The trap is the alert that's off by
  // two or more.
  if (skillId === 'severity') {
    const gap = Math.abs(SEVERITY_ORDER.indexOf(alert.reportedSeverity) - SEVERITY_ORDER.indexOf(truth.severity));
    if (gap >= 2) return { factor: 1 + 1.5 * (gap - 1), why: `the tool reports ${alert.reportedSeverity} but the case is ${truth.severity}` };
  }
  // Every scenario offers at least two harmful actions, so only the ones with
  // more than that single anything out.
  if (skillId === 'response') {
    const traps = (scenario.actions || []).filter((a) => a.verdict === 'harmful').length;
    if (traps >= 3) return { factor: 2.5, why: `offers ${plural(traps, 'response action')} that make things worse` };
  }
  // No structural rule for investigation, ATT&CK mapping, the report or
  // response time: the library doesn't vary enough on anything that predicts
  // them (ten of thirteen scenarios need exactly four checks, for example). For
  // those, the only honest signal is where *you* slipped, handled by the
  // missed-before boost in planFocus.
  if (skillId === 'classification' && truth.classification !== 'true_positive') {
    return { factor: 2.5, why: `isn't a straightforward true positive (${truth.classification.replace(/_/g, ' ')})` };
  }
  return null;
}

// The plan for the next shift: which skill to practise, and a weight per
// scenario. Deliberately a *weighting* and not a filter. The deal's mix quotas
// still apply on top, so a focused shift is still a realistic shift, never
// seven copies of one lesson.
export function planFocus(history, library) {
  const weak = weakestSkill(skillSummary(history));
  if (!weak) return null;

  const tendency = escalationTendency(history);
  const misses = missesByScenario(history, weak.id);
  const weights = {};
  const reasons = {};

  for (const scenario of library) {
    let weight = 1;
    const why = [];
    const boost = targetedBoost(weak.id, scenario, { tendency });
    if (boost) {
      weight *= boost.factor;
      why.push(boost.why);
    }
    if (misses[scenario.id]) {
      weight *= 2;
      why.push(`you missed ${weak.label.toLowerCase()} on it before`);
    }
    weights[scenario.id] = Math.min(MAX_WEIGHT, Math.round(weight * 100) / 100);
    if (why.length) reasons[scenario.id] = why.join('; ');
  }

  const missed = weak.attempts - weak.correct;
  let summary = `${weak.label}: ${missed} of your ${plural(weak.attempts, 'scored case')} missed.`;
  if (weak.id === 'escalation' && tendency.direction) {
    summary += ` You tend to ${tendency.direction}-escalate (${tendency[tendency.direction]} of ${tendency.total}).`;
  }

  return { skill: weak.id, label: weak.label, summary, weights, reasons };
}

export function describeSkill(id) {
  return skillById[id]?.label ?? id;
}
