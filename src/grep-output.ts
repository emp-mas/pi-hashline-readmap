import type { PtcLine, PtcWarning } from "./ptc-value.js";

export interface GrepOutputRecord extends PtcLine {
  path: string;
  kind: "match" | "context";
}

export type GrepOutputEntry =
  | { kind: "match" | "context"; line: PtcLine }
  | { kind: "separator"; text: string };

export interface GrepOutputScopeSymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  parentName?: string;
}

export interface GrepScopeWarning extends PtcWarning {
  path?: string;
  line?: number;
}

export interface GrepOutputGroup {
  displayPath: string;
  absolutePath: string;
  matchCount: number;
  entries: GrepOutputEntry[];
  scope?: {
    mode: "symbol";
    symbol: GrepOutputScopeSymbol;
    matchLines: number[];
  };
}

export interface BuildGrepOutputInput {
  summary: boolean;
  totalMatches: number;
  groups: GrepOutputGroup[];
  limit?: number;
  records: GrepOutputRecord[];
  scopeMode?: "symbol";
  scopeWarnings?: GrepScopeWarning[];
}

export interface GrepOutputResult {
  text: string;
  ptcValue: {
    tool: "grep";
    summary: boolean;
    totalMatches: number;
    records: GrepOutputRecord[];
    scopes?: {
      mode: "symbol";
      groups: Array<{
        path: string;
        displayPath: string;
        symbol: GrepOutputScopeSymbol;
        matchCount: number;
        matchLines: number[];
        lineAnchors: string[];
      }>;
      warnings: GrepScopeWarning[];
    };
  };
}

function renderEntry(displayPath: string, entry: GrepOutputEntry): string {
  if (entry.kind === "separator") return entry.text;
  const marker = entry.kind === "match" ? ">>" : "  ";
  return `${displayPath}:${marker}${entry.line.anchor}|${entry.line.display}`;
}

function renderGroupHeader(group: GrepOutputGroup): string {
  if (!group.scope) {
    return `--- ${group.displayPath} (${group.matchCount} matches) ---`;
  }

  const parent = group.scope.symbol.parentName ? ` in ${group.scope.symbol.parentName}` : "";
  return `--- ${group.displayPath} :: ${group.scope.symbol.kind} ${group.scope.symbol.name}${parent} (${group.scope.symbol.startLine}-${group.scope.symbol.endLine}, ${group.matchCount} matches) ---`;
}

function buildScopeMetadata(groups: GrepOutputGroup[], warnings: GrepScopeWarning[]) {
  return {
    mode: "symbol" as const,
    groups: groups
      .filter((group) => group.scope)
      .map((group) => ({
        path: group.absolutePath,
        displayPath: group.displayPath,
        symbol: group.scope!.symbol,
        matchCount: group.matchCount,
        matchLines: [...group.scope!.matchLines],
        lineAnchors: group.entries.flatMap((entry) => (entry.kind === "separator" ? [] : [entry.line.anchor])),
      })),
    warnings: [...warnings],
  };
}

export function buildGrepOutput(input: BuildGrepOutputInput): GrepOutputResult {
  const fileCount = new Set(input.groups.map((group) => group.absolutePath)).size;
  const header = `[${input.totalMatches} matches in ${fileCount} files]`;
  let text: string;

  if (input.summary) {
    const fileLines = [...input.groups]
      .sort((a, b) => b.matchCount - a.matchCount)
      .map((group) => `${group.absolutePath}: ${group.matchCount} matches`);
    text = [header, ...fileLines].join("\n");
  } else {
    const blocks: string[] = [header];
    for (const group of input.groups) {
      blocks.push(renderGroupHeader(group));
      for (const entry of group.entries) {
        blocks.push(renderEntry(group.displayPath, entry));
      }
    }
    text = blocks.join("\n");
  }

  if (input.limit !== undefined && input.totalMatches === input.limit) {
    text += `\n\n[Results truncated at ${input.limit} matches — refine pattern or increase limit]`;
  }

  if (!input.summary && input.scopeMode === "symbol" && (input.scopeWarnings?.length ?? 0) > 0) {
    text = `${input.scopeWarnings!.map((warning) => warning.message).join("\n\n")}\n\n${text}`;
  }

  const ptcValue: GrepOutputResult["ptcValue"] = {
    tool: "grep",
    summary: input.summary,
    totalMatches: input.totalMatches,
    records: input.records,
  };

  if (!input.summary && input.scopeMode === "symbol") {
    ptcValue.scopes = buildScopeMetadata(input.groups, input.scopeWarnings ?? []);
  }

  return {
    text,
    ptcValue,
  };
}
