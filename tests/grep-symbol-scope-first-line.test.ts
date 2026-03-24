import { beforeAll, describe, expect, it } from "vitest";
import { ensureHashInit } from "../src/hashline.js";
import { buildPtcLine } from "../src/ptc-value.js";
import { scopeGrepGroupsToSymbols } from "../src/grep-symbol-scope.js";
import { DetailLevel, SymbolKind } from "../src/readmap/enums.js";
import type { FileMap } from "../src/readmap/types.js";

describe("scopeGrepGroupsToSymbols ordering", () => {
  beforeAll(async () => {
    await ensureHashInit();
  });

  it("keeps deterministic ordering when groups include separators", () => {
    const lines = ["export function alpha() {", "  const x = 1;", "}"];
    const map: FileMap = {
      path: "/tmp/a.ts",
      totalLines: 3,
      totalBytes: lines.join("\n").length,
      language: "typescript",
      detailLevel: DetailLevel.Full,
      imports: [],
      symbols: [{ name: "alpha", kind: SymbolKind.Function, startLine: 1, endLine: 3 }],
    };

    const scoped = scopeGrepGroupsToSymbols({
      groups: [
        {
          displayPath: "a.ts",
          absolutePath: "/tmp/a.ts",
          matchCount: 1,
          entries: [
            { kind: "separator", text: "--" },
            { kind: "match", line: buildPtcLine(2, lines[1]) },
          ],
        },
      ],
      fileLinesByPath: new Map([["/tmp/a.ts", lines]]),
      fileMapsByPath: new Map([["/tmp/a.ts", map]]),
      contextLines: 0,
    });

    expect(scoped.warnings).toEqual([]);
    expect(scoped.groups).toHaveLength(1);
    expect(scoped.groups[0].scope?.symbol.name).toBe("alpha");
  });
});
