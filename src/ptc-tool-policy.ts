export type HashlineToolName = "read" | "grep" | "sg" | "edit";

export type HashlineToolMutability = "read-only" | "mutating";

export type HashlineToolDefaultExposure =
  | "safe-by-default"
  | "opt-in"
  | "not-safe-by-default";

export interface HashlineToolPtcPolicyEntry {
  toolName: HashlineToolName;
  helperName: string;
  overridesBuiltin: boolean;
  mutability: HashlineToolMutability;
  defaultExposure: HashlineToolDefaultExposure;
}

export interface HashlineToolPtcPolicy {
  version: 1;
  tools: Record<HashlineToolName, HashlineToolPtcPolicyEntry>;
}

export const HASHLINE_TOOL_PTC_POLICY: HashlineToolPtcPolicy = {
  version: 1,
  tools: {
    read: {
      toolName: "read",
      helperName: "hashline-read",
      overridesBuiltin: true,
      mutability: "read-only",
      defaultExposure: "safe-by-default",
    },
    grep: {
      toolName: "grep",
      helperName: "hashline-grep",
      overridesBuiltin: true,
      mutability: "read-only",
      defaultExposure: "safe-by-default",
    },
    sg: {
      toolName: "sg",
      helperName: "hashline-sg",
      overridesBuiltin: false,
      mutability: "read-only",
      defaultExposure: "opt-in",
    },
    edit: {
      toolName: "edit",
      helperName: "hashline-edit",
      overridesBuiltin: true,
      mutability: "mutating",
      defaultExposure: "not-safe-by-default",
    },
  },
};

export function getHashlineToolPtcPolicy(): HashlineToolPtcPolicy {
  return HASHLINE_TOOL_PTC_POLICY;
}
