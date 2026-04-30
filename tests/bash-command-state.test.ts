import { describe, expect, it } from "vitest";
import { buildBashCommandState } from "../src/bash-command-state.js";

describe("buildBashCommandState", () => {
  it("classifies git repo-state, history, and mutation commands", () => {
    expect(buildBashCommandState({ command: " git   status --short ", isError: false, text: " M src/a.ts" })).toMatchObject({
      normalizedCommand: "git status --short",
      commandKind: "vcs",
      stateKind: "repo-status",
      outcome: "success",
      semanticInvalidationSensitive: true,
      routineRetirementEligible: false,
      protectedFromRoutineRetirement: false,
    });

    expect(buildBashCommandState({ command: "git diff -- src/a.ts", isError: false, text: "diff --git a/src/a.ts b/src/a.ts" })).toMatchObject({
      normalizedCommand: "git diff -- src/a.ts",
      commandKind: "vcs",
      stateKind: "repo-diff",
      outcome: "success",
      semanticInvalidationSensitive: true,
      routineRetirementEligible: false,
    });

    expect(buildBashCommandState({ command: "git log --oneline -5", isError: false, text: "abc commit" })).toMatchObject({
      normalizedCommand: "git log --oneline -5",
      commandKind: "vcs",
      stateKind: "git-history",
      outcome: "success",
      semanticInvalidationSensitive: false,
      routineRetirementEligible: true,
    });

    expect(buildBashCommandState({ command: "git add src/a.ts", isError: false, text: "" })).toMatchObject({
      normalizedCommand: "git add src/a.ts",
      commandKind: "vcs",
      stateKind: "git-worktree-mutation",
      outcome: "success",
      protectedFromRoutineRetirement: true,
    });
  });

  it("classifies verification commands with exact normalized targets", () => {
    expect(buildBashCommandState({ command: "npm test", isError: true, text: "FAIL tests/a.test.ts" })).toMatchObject({
      normalizedCommand: "npm test",
      commandKind: "test",
      stateKind: "verification",
      outcome: "failure",
      protectedFromRoutineRetirement: true,
      routineRetirementEligible: false,
    });

    expect(buildBashCommandState({ command: "npm test -- tests/a.test.ts", isError: false, text: "PASS tests/a.test.ts" })).toMatchObject({
      normalizedCommand: "npm test -- tests/a.test.ts",
      commandKind: "test",
      stateKind: "verification",
      outcome: "success",
      protectedFromRoutineRetirement: false,
      routineRetirementEligible: true,
    });
  });

  it("protects diagnostics and unusual debugging output from routine retirement", () => {
    expect(buildBashCommandState({ command: "node debug-script.js", isError: false, text: "TypeError: boom\n    at main (debug-script.js:1:1)" })).toMatchObject({
      normalizedCommand: "node debug-script.js",
      commandKind: "other",
      stateKind: "debug",
      outcome: "success",
      containsDiagnostics: true,
      protectedFromRoutineRetirement: true,
      routineRetirementEligible: false,
    });
  });
});
