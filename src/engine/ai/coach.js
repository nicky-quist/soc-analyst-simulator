// AI coach prompt

import { formatDuration } from '../../ui/helpers.js';
import { generate } from './provider.js';

// Compact timeline
function summarizeTimeline(timeline = []) {
  const lines = [];
  let quietFound = 0;

  for (const entry of timeline) {
    const atLabel = formatDuration(entry.at);
    if (entry.kind === 'search' && !entry.text.includes('0 events')) {
      quietFound += 1;
      continue;
    }
    lines.push(`[${atLabel}] ${entry.text}`);
  }

  if (quietFound) lines.unshift(`(${quietFound} other search${quietFound === 1 ? '' : 'es'} returned results without issue)`);
  return lines.join('\n');
}

function formatRubric(rubricResults = []) {
  return rubricResults
    .map((r) => `- [${r.matched ? 'x' : ' '}] ${r.point}`)
    .join('\n');
}

export function buildCoachPrompt(scenario, submission, score, timeline) {
  const { truth } = scenario;
  const { investigation, response } = score;

  return `You are a senior SOC analyst mentoring a Tier-1 trainee right after they closed an alert. Be specific and reference what they actually did — never generic advice. Keep it to 2-3 short paragraphs, plain prose, no headings or bullet lists in your reply.

ALERT: ${scenario.queueLabel}
GROUND TRUTH: classification=${truth.classification}, severity=${truth.severity}, escalation=${truth.escalation}, technique=${truth.mitreTechnique}

WHAT THE TRAINEE SUBMITTED: classification=${submission.classification}, severity=${submission.severity}, escalation=${submission.escalation}, technique=${submission.mitreTechnique || '(none)'}
Their written summary: "${submission.summary || '(blank)'}"
Their remediation notes: "${submission.remediation || '(blank)'}"

INVESTIGATION TRACE (compressed — quiet successful searches are counted, not listed):
${summarizeTimeline(timeline) || '(no timeline recorded)'}

MISSED REQUIRED CHECKS: ${investigation.missed.length ? investigation.missed.join('; ') : 'none'}
HARMFUL ACTIONS TAKEN: ${response.harmful.length ? response.harmful.map((a) => a.label).join('; ') : 'none'}
MISSING REQUIRED RESPONSE ACTIONS: ${response.missing.length ? response.missing.join('; ') : 'none'}
REPORT RUBRIC (checked automatically by keyword match, not your judgment to re-score):
${formatRubric(score.rubricResults)}
OVERALL SCORE: ${score.overallScore}/100

Write the debrief. Speak to the trainee as "you". Call out the single most important thing they got right or wrong before anything smaller, the way a real mentor would triage their own feedback.`;
}

// opts.onToken lets the caller render tokens as they stream in.
export async function generateCoachDebrief(providerSettings, scenario, submission, score, timeline, opts = {}) {
  const prompt = buildCoachPrompt(scenario, submission, score, timeline);
  return generate(providerSettings, prompt, opts);
}
