"use strict";

const HEADLESS_COMPLETION_DEBOUNCE_MS = 2000;
const BACKGROUND_TASKS_COMPLETION_DEBOUNCE_MS = 2000;
// An interactive Stop is not necessarily the end of the task: loops and
// scheduled prompts fire the next turn tens of seconds later, and every
// intermediate Stop used to celebrate (and ping) as if the whole task were
// done. A quiet window lets the next turn cancel the celebration; only a
// silence this long promotes it as a real completion.
const INTERACTIVE_COMPLETION_DEBOUNCE_MS = 30000;

function getCompletionDebounceMs(headless, env = process.env) {
  const n = Number.parseInt(env && env.CLAWD_COMPLETION_DEBOUNCE_MS, 10);
  if (Number.isFinite(n) && n >= 0 && n <= 300000) return n;
  return headless ? HEADLESS_COMPLETION_DEBOUNCE_MS : INTERACTIVE_COMPLETION_DEBOUNCE_MS;
}

function getBackgroundTasksCompletionDebounceMs(headless, env = process.env) {
  const n = Number.parseInt(env && env.CLAWD_COMPLETION_DEBOUNCE_MS, 10);
  if (Number.isFinite(n) && n >= 0 && n <= 300000) return n;
  return BACKGROUND_TASKS_COMPLETION_DEBOUNCE_MS;
}

function getClaudeStopDisposition(options = {}) {
  const backgroundTasksCount = Number(options.backgroundTasksCount) || 0;
  const backgroundSubagentsCount = Number.isSafeInteger(options.backgroundSubagentsCount)
    && options.backgroundSubagentsCount >= 0
    ? options.backgroundSubagentsCount
    : 0;
  const sessionCronsCount = Number(options.sessionCronsCount) || 0;
  const stopHookActive = options.stopHookActive === true;
  const hasFinalAssistantText = options.hasFinalAssistantText === true;
  const headless = options.headless === true;
  const hardLiveWork = backgroundSubagentsCount > 0
    || sessionCronsCount > 0
    || stopHookActive
    || (backgroundTasksCount > 0 && !hasFinalAssistantText);
  if (hardLiveWork) return { kind: "hold", debounceMs: 0 };
  // A background-task Stop with final text carries its own end-of-work
  // signal — keep its short compatibility window instead of stretching it
  // to the interactive quiet window. Only a bare interactive Stop waits out
  // the full window, so a loop's intermediate turns can be cancelled by the
  // next prompt while a genuine finish isn't delayed by background noise.
  const debounceMs = backgroundTasksCount > 0 && hasFinalAssistantText
    ? getBackgroundTasksCompletionDebounceMs(headless, options.env)
    : getCompletionDebounceMs(headless, options.env);
  return debounceMs > 0
    ? { kind: "debounce", debounceMs }
    : { kind: "complete", debounceMs: 0 };
}

module.exports = {
  HEADLESS_COMPLETION_DEBOUNCE_MS,
  BACKGROUND_TASKS_COMPLETION_DEBOUNCE_MS,
  getCompletionDebounceMs,
  getBackgroundTasksCompletionDebounceMs,
  getClaudeStopDisposition,
};
