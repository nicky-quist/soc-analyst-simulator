// Blue team scoring

export const SCORE_WEIGHTS = {
  classification: 20,
  escalation: 20,
  severity: 10,
  mitre: 10,
  report: 25,
  response: 15,
};

export const SEVERITY_ORDER = ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const ESCALATION_RANK = {
  close_no_escalation: 0,
  close_false_positive: 0,
  escalate_tier2: 1,
  escalate_ir: 2,
};

// Asserted vs hedged keywords
const HEDGE_BEFORE =
  /\b(no|not|never|n't|avoid|avoiding|without|rather|instead|potential|potentially|possible|possibly|suspected|suspect|apparent|apparently|alleged|allegedly|may|might|could|appears|appear|appeared|indicates|indicating|consistent|risk|prevent|preventing|investigate|investigating|whether|if|unconfirmed|unproven|pending)\b[\s\S]{0,40}$/i;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordRegex(keyword) {
  const isStem = keyword.endsWith('*');
  const body = escapeRegex(isStem ? keyword.slice(0, -1) : keyword);
  return new RegExp(`(?<![\\w])${body}${isStem ? '' : '(?![\\w])'}`, 'i');
}

export function findKeyword(text, keyword) {
  const match = keywordRegex(keyword).exec(text);
  return match ? { index: match.index, text: match[0] } : null;
}

function matchesAny(text, keywords) {
  return keywords.some((k) => findKeyword(text, k) !== null);
}

// Hedges apply within the clause
function clauseBefore(text, index) {
  const before = text.slice(0, index);
  const cut = Math.max(
    before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'),
    before.lastIndexOf(';'), before.lastIndexOf('\n')
  );
  return before.slice(cut + 1);
}

function assertsAny(text, keywords) {
  return keywords.some((k) => {
    const hit = findKeyword(text, k);
    if (!hit) return false;
    return !HEDGE_BEFORE.test(clauseBefore(text, hit.index));
  });
}

function gradeReportPoint(point, text) {
  if (point.any && point.any.length) {
    return { point: point.point, matched: matchesAny(text, point.any), kind: 'positive' };
  }
  if (point.none && point.none.length) {
    return { point: point.point, matched: !assertsAny(text, point.none), kind: 'avoid' };
  }
  return { point: point.point, matched: null, kind: 'manual' };
}

function normalizeTechnique(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

// ATT&CK parent/sub-technique credit
export function gradeTechnique(submitted, truth) {
  const a = normalizeTechnique(submitted);
  const b = normalizeTechnique(truth).split('(')[0];
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

// Severity credit
export function gradeSeverity(submitted, truth) {
  const a = SEVERITY_ORDER.indexOf(submitted);
  const b = SEVERITY_ORDER.indexOf(truth);
  if (a === -1 || b === -1) return { correct: false, credit: 0, distance: null };
  const distance = Math.abs(a - b);
  if (distance === 0) return { correct: true, credit: 1, distance };
  if (distance === 1) return { correct: false, credit: 0.5, distance };
  return { correct: false, credit: 0, distance };
}

// Search coverage key
export function searchKey(search) {
  return search.satisfies || search.id;
}

function searchLabel(scenario, key) {
  const match = (scenario.searches || []).find((s) => searchKey(s) === key || s.id === key);
  return match ? match.label : key;
}

// Investigation grade
export function evaluateInvestigation(scenario, caseFile = {}) {
  const truth = scenario.truth;
  const searchesRun = caseFile.searchesRun || [];
  const intelChecked = (caseFile.intelChecked || []).map((v) => String(v).toLowerCase());

  const missedSearches = (truth.requiredSearches || [])
    .filter((key) => !searchesRun.includes(key))
    .map((key) => searchLabel(scenario, key));
  const missedIntel = (truth.requiredIntel || []).filter((v) => !intelChecked.includes(String(v).toLowerCase()));

  const requiredCount = (truth.requiredSearches || []).length + (truth.requiredIntel || []).length;
  const missedCount = missedSearches.length + missedIntel.length;

  return {
    requiredCount,
    completedCount: requiredCount - missedCount,
    coverage: requiredCount ? (requiredCount - missedCount) / requiredCount : 1,
    missedSearches,
    missedIntel,
    missed: [...missedSearches, ...missedIntel.map((v) => `Threat intel lookup: ${v}`)],
    noiseSearches: caseFile.noiseSearches || 0,
  };
}

// Response grade
export function evaluateResponse(scenario, caseFile = {}) {
  const taken = caseFile.actionsTaken || [];
  const actions = scenario.actions || [];
  const byId = (id) => actions.find((a) => a.id === id);

  const required = scenario.truth.requiredActions || [];
  const takenRequired = required.filter((id) => taken.includes(id));
  const missing = required.filter((id) => !taken.includes(id)).map((id) => byId(id)?.label || id);

  const harmful = taken.map(byId).filter((a) => a && a.verdict === 'harmful');
  const unnecessary = taken.map(byId).filter((a) => a && a.verdict === 'unnecessary');

  const base = required.length ? takenRequired.length / required.length : 1;
  const credit = Math.max(0, Math.min(1, base - 0.34 * harmful.length - 0.1 * unnecessary.length));

  return {
    requiredCount: required.length,
    completedCount: takenRequired.length,
    missing,
    harmful,
    unnecessary,
    credit,
  };
}

export function scoreCase(scenario, submission, caseFile = {}) {
  const { truth } = scenario;
  const combinedText = `${submission.summary || ''} ${submission.remediation || ''}`;

  const classificationCorrect = submission.classification === truth.classification;
  const escalationCorrect = submission.escalation === truth.escalation;
  const severity = gradeSeverity(submission.severity, truth.severity);
  const mitreCorrect = gradeTechnique(submission.mitreTechnique, truth.mitreTechnique);

  const rubricResults = truth.requiredReportPoints.map((p) => gradeReportPoint(p, combinedText));
  const scorable = rubricResults.filter((r) => r.matched !== null);
  const matchedCount = scorable.filter((r) => r.matched).length;
  const rubricScore = scorable.length ? matchedCount / scorable.length : 1;

  const investigation = evaluateInvestigation(scenario, caseFile);
  const response = evaluateResponse(scenario, caseFile);

  const overallScore = Math.round(
    (classificationCorrect ? SCORE_WEIGHTS.classification : 0) +
    (escalationCorrect ? SCORE_WEIGHTS.escalation : 0) +
    severity.credit * SCORE_WEIGHTS.severity +
    (mitreCorrect ? SCORE_WEIGHTS.mitre : 0) +
    rubricScore * SCORE_WEIGHTS.report +
    response.credit * SCORE_WEIGHTS.response
  );

  return {
    overallScore,
    classificationCorrect,
    escalationCorrect,
    severityCorrect: severity.correct,
    severityCredit: severity.credit,
    severityDistance: severity.distance,
    mitreCorrect,
    rubricResults,
    matchedCount,
    scorableCount: scorable.length,
    investigation,
    response,
    assisted: !!caseFile.assisted,
    elapsedMs: caseFile.elapsedMs ?? null,
    withinResponseTarget:
      truth.responseTargetMinutes && caseFile.elapsedMs != null
        ? caseFile.elapsedMs <= truth.responseTargetMinutes * 60_000
        : null,
  };
}

// Verdict
export function isResolvedCorrectly(score) {
  return (
    score.classificationCorrect &&
    score.escalationCorrect &&
    score.severityCredit > 0 &&
    score.response.harmful.length === 0 &&
    score.overallScore >= 70
  );
}

export function underEscalated(scenario, submission) {
  return (ESCALATION_RANK[submission.escalation] ?? 0) < (ESCALATION_RANK[scenario.truth.escalation] ?? 0);
}

export function overEscalated(scenario, submission) {
  return (ESCALATION_RANK[submission.escalation] ?? 0) > (ESCALATION_RANK[scenario.truth.escalation] ?? 0);
}
