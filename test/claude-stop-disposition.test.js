"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { getClaudeStopDisposition } = require("../hooks/claude-stop-disposition");

describe("Claude Stop disposition typed background-subagent gate (#952)", () => {
  it("hard-holds a positive typed count with or without final text, even when debounce is disabled", () => {
    for (const hasFinalAssistantText of [false, true]) {
      assert.deepStrictEqual(getClaudeStopDisposition({
        backgroundSubagentsCount: 1,
        hasFinalAssistantText,
        env: { CLAWD_COMPLETION_DEBOUNCE_MS: "0" },
      }), { kind: "hold", debounceMs: 0 });
    }
  });

  it("keeps the existing total-background final-text compatibility debounce at typed zero", () => {
    assert.deepStrictEqual(getClaudeStopDisposition({
      backgroundTasksCount: 1,
      backgroundSubagentsCount: 0,
      hasFinalAssistantText: true,
      env: {},
    }), { kind: "debounce", debounceMs: 2000 });
  });

  it("does not turn malformed, zero, negative, or fractional typed values into hard holds", () => {
    for (const value of [undefined, null, 0, -1, -0.5, 0.5, "invalid", {}, []]) {
      assert.deepStrictEqual(getClaudeStopDisposition({
        backgroundSubagentsCount: value,
        env: { CLAWD_COMPLETION_DEBOUNCE_MS: "0" },
      }), { kind: "complete", debounceMs: 0 });
    }
  });

  it("retains cron and stop-hook hard-hold precedence", () => {
    assert.strictEqual(getClaudeStopDisposition({ sessionCronsCount: 1 }).kind, "hold");
    assert.strictEqual(getClaudeStopDisposition({ stopHookActive: true }).kind, "hold");
  });

  // Loops and scheduled prompts fire the next turn tens of seconds after an
  // intermediate Stop; the interactive quiet window lets that next turn
  // cancel the celebration so only a genuine finish promotes.
  it("debounces a bare interactive Stop by the quiet window instead of promoting", () => {
    assert.deepStrictEqual(getClaudeStopDisposition({
      backgroundTasksCount: 0,
      hasFinalAssistantText: true,
      headless: false,
      env: {},
    }), { kind: "debounce", debounceMs: 30000 });
    assert.deepStrictEqual(getClaudeStopDisposition({
      hasFinalAssistantText: false,
      headless: false,
      env: {},
    }), { kind: "debounce", debounceMs: 30000 });
    // env override stays available for tuning, now up to five minutes.
    assert.deepStrictEqual(getClaudeStopDisposition({
      headless: false,
      env: { CLAWD_COMPLETION_DEBOUNCE_MS: "120000" },
    }), { kind: "debounce", debounceMs: 120000 });
    assert.deepStrictEqual(getClaudeStopDisposition({
      headless: true,
      env: {},
    }), { kind: "debounce", debounceMs: 2000 });
  });
});
