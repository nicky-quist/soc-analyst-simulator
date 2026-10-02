// Blue team progress

import { SEVERITY_ORDER, isResolvedCorrectly, overEscalated, underEscalated } from './scoring.js';

export const HISTORY_LIMIT = 500;
export const MIN_ATTEMPTS = 4;      // attempts before a skill can be called weak
export const WEAK_BELOW = 0.75;     // smoothed success rate that counts as weak
export const RECENT_WINDOW = 5;     // cases compared against everything before them
export const MAX_WEIGHT = 4;        // no scenario is ever more than 4x as likely as another

// Skills
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
  return { history: [], adaptive: true, checkpointRankIndex: 0 };
}

export function caseKey(shiftStartedAt, deal, scenarioId) {
  return `${shiftStartedAt}:${deal}:${scenarioId}`;
}

// History record
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

// Record a case
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
    // Need data on both sides
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

// SLA compliance trend
export function slaComplianceTrend(history) {
  const relevant = history.filter((r) => r.outcomes.sla === true || r.outcomes.sla === false);
  let onTime = 0;
  return relevant.map((r, i) => {
    if (r.outcomes.sla) onTime += 1;
    return { day: i + 1, pct: Math.round((onTime / (i + 1)) * 100), breached: !r.outcomes.sla };
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

// Misses per scenario
function missesByScenario(history, skillId) {
  const misses = {};
  for (const r of history) {
    if (r.outcomes[skillId] === false) misses[r.scenarioId] = (misses[r.scenarioId] || 0) + 1;
  }
  return misses;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Weakness to scenario weights
function targetedBoost(skillId, scenario, context) {
  const { truth, alert } = scenario;

  // Under-escalation
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
  // Severity calls
  if (skillId === 'severity') {
    const gap = Math.abs(SEVERITY_ORDER.indexOf(alert.reportedSeverity) - SEVERITY_ORDER.indexOf(truth.severity));
    if (gap >= 2) return { factor: 1 + 1.5 * (gap - 1), why: `the tool reports ${alert.reportedSeverity} but the case is ${truth.severity}` };
  }
  // Harmful actions
  if (skillId === 'response') {
    const traps = (scenario.actions || []).filter((a) => a.verdict === 'harmful').length;
    if (traps >= 3) return { factor: 2.5, why: `offers ${plural(traps, 'response action')} that make things worse` };
  }
  // Other skills use the missed-before boost
  if (skillId === 'classification' && truth.classification !== 'true_positive') {
    return { factor: 2.5, why: `isn't a straightforward true positive (${truth.classification.replace(/_/g, ' ')})` };
  }
  return null;
}

// Next shift's focus
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

// Blue team career
export const PROMOTION_SCORE_BAR = 80;

export const CAREER_RANKS = [
  { id: 'trainee', label: 'Trainee' },
  { id: 'analyst', label: 'Tier 1 Analyst' },
  { id: 'senior', label: 'Senior Analyst — Tier 2 ready' },
];

function bestScoreByScenario(history) {
  const best = {};
  for (const r of history) {
    if (best[r.scenarioId] === undefined || r.overallScore > best[r.scenarioId]) best[r.scenarioId] = r.overallScore;
  }
  return best;
}

// Leaderboard stats
export function clearedCaseTypes(history, library) {
  const libraryIds = new Set(library.map((s) => s.id));
  return Object.entries(bestScoreByScenario(history))
    .filter(([id, score]) => libraryIds.has(id) && score >= PROMOTION_SCORE_BAR).length;
}

export function averageBestScore(history) {
  const scores = Object.values(bestScoreByScenario(history));
  return scores.length ? Math.round(scores.reduce((n, v) => n + v, 0) / scores.length) : null;
}

// Career rank
export function careerStatus(history, library, checkpointRankIndex = 0) {
  const best = bestScoreByScenario(history);
  const libraryIds = new Set(library.map((s) => s.id));
  const qualifying = Object.entries(best).filter(([id, score]) => libraryIds.has(id) && score >= PROMOTION_SCORE_BAR);
  const qualifyingCount = qualifying.length;

  const summary = skillSummary(history);
  const weak = weakestSkill(summary);
  const tendency = escalationTendency(history);
  const responseSkill = summary.find((s) => s.id === 'response');
  const responseRate = responseSkill ? Math.round(responseSkill.smoothed * 100) : 50;

  const analystCriteria = [{
    label: `${PROMOTION_SCORE_BAR}%+ on 10 different case types`,
    met: qualifyingCount >= 10,
    current: `${qualifyingCount}`,
    target: '10',
  }];

  const seniorCriteria = [
    {
      label: `${PROMOTION_SCORE_BAR}%+ on every case type in the library`,
      met: qualifyingCount >= libraryIds.size,
      current: `${qualifyingCount}`,
      target: `${libraryIds.size}`,
    },
    {
      label: 'No current weak skill',
      met: !weak,
      current: weak ? weak.label : 'none',
      target: 'none',
    },
    {
      label: 'No consistent escalation lean',
      met: !tendency.direction,
      current: tendency.direction ? `${tendency.direction}-escalates` : 'none',
      target: 'none',
    },
    {
      label: 'Clean response actions at least 90% of the time',
      met: responseRate >= 90,
      current: `${responseRate}%`,
      target: '90%',
    },
  ];

  let liveRankIndex = 0;
  if (analystCriteria.every((c) => c.met)) liveRankIndex = 1;
  if (liveRankIndex === 1 && seniorCriteria.every((c) => c.met)) liveRankIndex = 2;

  // Checkpoint holds the rank
  const rankIndex = Math.max(liveRankIndex, checkpointRankIndex);
  const rank = CAREER_RANKS[rankIndex];
  const next = CAREER_RANKS[rankIndex + 1] || null;
  const criteria = rankIndex === 0 ? analystCriteria : rankIndex === 1 ? seniorCriteria : [];

  return {
    rank: rank.label,
    rankId: rank.id,
    rankIndex,
    next: next?.label ?? null,
    criteria,
    // Rank held only by checkpoint
    viaCheckpoint: rankIndex > liveRankIndex,
  };
}

// Raise the checkpoint
export function advanceCheckpoint(progress, library) {
  const current = progress.checkpointRankIndex ?? 0;
  const { rankIndex } = careerStatus(progress.history, library, current);
  if (rankIndex <= current) return progress;
  return { ...progress, checkpointRankIndex: rankIndex };
}
