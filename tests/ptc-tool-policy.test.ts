import { describe, it, expect } from "vitest";

describe("hashline tool ptc policy contract", () => {
  it("exports canonical tool policies with exact policy tiers and a versioned minimal shape", async () => {
    const mod = await import("../src/ptc-tool-policy.js");

    expect(mod.getHashlineToolPtcPolicy()).toBe(mod.HASHLINE_TOOL_PTC_POLICY);
    expect(Object.keys(mod.HASHLINE_TOOL_PTC_POLICY.tools)).toEqual(["read", "grep", "sg", "edit"]);
    expect(mod.HASHLINE_TOOL_PTC_POLICY).toEqual({
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
    });
  });
});
