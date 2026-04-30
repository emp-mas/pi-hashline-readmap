import {
  classifyCommandForContextHygiene,
  normalizeCommandForContextHygiene,
  type ContextHygieneCommandKind,
} from "./context-hygiene.js";

export type BashCommandStateKind =
  | "repo-status"
  | "repo-diff"
  | "git-history"
  | "git-worktree-mutation"
  | "verification"
  | "routine"
  | "debug";

export type BashCommandOutcome = "success" | "failure";

export interface BuildBashCommandStateInput {
  command: string;
  isError?: boolean;
  text?: string;
}

export interface BashCommandState {
  command: string;
  normalizedCommand: string;
  commandKind: ContextHygieneCommandKind;
  stateKind: BashCommandStateKind;
  outcome: BashCommandOutcome;
  containsDiagnostics: boolean;
  semanticInvalidationSensitive: boolean;
  routineRetirementEligible: boolean;
  protectedFromRoutineRetirement: boolean;
}

const GIT_WORKTREE_MUTATION_RE =
  /^git\s+(add|apply|am|checkout|clean|commit|merge|mv|pull|rebase|reset|restore|rm|stash|switch)\b/;

function containsDiagnostics(text: string): boolean {
  return /\b(error TS\d+|TypeError:|ReferenceError:|SyntaxError:|AssertionError:|\bat\s+\S+\s+\([^)]*:\d+:\d+\)|FAIL\b)/.test(text);
}

function classifyStateKind(normalizedCommand: string, commandKind: ContextHygieneCommandKind): BashCommandStateKind {
  if (/^git\s+status\b/.test(normalizedCommand)) return "repo-status";
  if (/^git\s+diff\b/.test(normalizedCommand)) return "repo-diff";
  if (/^git\s+log\b/.test(normalizedCommand)) return "git-history";
  if (GIT_WORKTREE_MUTATION_RE.test(normalizedCommand)) return "git-worktree-mutation";
  if (commandKind === "test" || commandKind === "typecheck" || commandKind === "build" || commandKind === "lint") {
    return "verification";
  }
  if (commandKind === "install") return "routine";
  return "debug";
}

export function buildBashCommandState(input: BuildBashCommandStateInput): BashCommandState {
  const normalizedCommand = normalizeCommandForContextHygiene(input.command);
  const commandKind = classifyCommandForContextHygiene(normalizedCommand);
  const stateKind = classifyStateKind(normalizedCommand, commandKind);
  const outcome: BashCommandOutcome = input.isError === true ? "failure" : "success";
  const diagnostic = containsDiagnostics(input.text ?? "");
  const semanticInvalidationSensitive = stateKind === "repo-status" || stateKind === "repo-diff";
  const protectedFromRoutineRetirement =
    outcome === "failure" ||
    diagnostic ||
    stateKind === "debug" ||
    stateKind === "git-worktree-mutation";

  return {
    command: input.command,
    normalizedCommand,
    commandKind,
    stateKind,
    outcome,
    containsDiagnostics: diagnostic,
    semanticInvalidationSensitive,
    routineRetirementEligible: outcome === "success" && !protectedFromRoutineRetirement && !semanticInvalidationSensitive,
    protectedFromRoutineRetirement,
  };
}
