import { describe, it, expect, beforeAll } from "vitest";
import { ensureHashInit } from "../src/hashline.js";
import { buildEditOutput } from "../src/edit-output.js";

describe("buildEditOutput semanticSummary", () => {
  beforeAll(async () => {
    await ensureHashInit();
  });

  it("includes semanticSummary in ptcValue when provided", () => {
    const result = buildEditOutput({
      path: "/tmp/test.ts",
      displayPath: "test.ts",
      diff: "+1 const x = 10;",
      firstChangedLine: 1,
      warnings: [],
      noopEdits: [],
      semanticSummary: {
        classification: "semantic",
        difftasticAvailable: true,
        movedBlocks: 0,
      },
    });

    expect(result.ptcValue.semanticSummary).toEqual({
      classification: "semantic",
      difftasticAvailable: true,
      movedBlocks: 0,
    });
  });

  it("omits semanticSummary from ptcValue when not provided", () => {
    const result = buildEditOutput({
      path: "/tmp/test.ts",
      displayPath: "test.ts",
      diff: "+1 const x = 10;",
      firstChangedLine: 1,
      warnings: [],
      noopEdits: [],
    });

    expect(result.ptcValue.semanticSummary).toBeUndefined();
  });

  it("preserves existing ptcValue fields when semanticSummary is present", () => {
    const result = buildEditOutput({
      path: "/tmp/test.ts",
      displayPath: "test.ts",
      diff: "+1 const x = 10;",
      firstChangedLine: 1,
      warnings: ["some warning"],
      noopEdits: [],
      semanticSummary: {
        classification: "whitespace-only",
        difftasticAvailable: false,
      },
    });

    expect(result.ptcValue.tool).toBe("edit");
    expect(result.ptcValue.ok).toBe(true);
    expect(result.ptcValue.path).toBe("/tmp/test.ts");
    expect(result.ptcValue.warnings).toEqual(["some warning"]);
    expect(result.ptcValue.semanticSummary).toEqual({
      classification: "whitespace-only",
      difftasticAvailable: false,
    });
  });
});
