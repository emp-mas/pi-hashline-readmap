import { createRequire } from "node:module";

import { detectLanguage } from "./readmap/language-detect.js";

export interface ValidateInput {
  filePath: string;
  before: string | undefined;
  after: string;
}

export interface ValidateResult {
  errorLines: string[];
  newErrorCount: number;
  newMissingCount: number;
}

interface NodeStats {
  errors: Array<{ startLine: number; endLine: number }>;
  missing: Array<{ startLine: number; endLine: number }>;
}

const require_ = createRequire(import.meta.url);

const PARSER_MODULES: Record<string, string> = {
  rust: "tree-sitter-rust",
  cpp: "tree-sitter-cpp",
  "c-header": "tree-sitter-cpp",
  java: "tree-sitter-java",
  clojure: "tree-sitter-clojure",
};

const parserCache = new Map<string, import("tree-sitter") | null>();

function ensureWritableTypeProperty(parserCtor: unknown): void {
  const syntaxNode = (parserCtor as { SyntaxNode?: { prototype?: object } }).SyntaxNode;
  const proto = syntaxNode?.prototype;
  if (!proto) return;
  const desc = Object.getOwnPropertyDescriptor(proto, "type");
  if (!desc || desc.set) return;
  Object.defineProperty(proto, "type", { ...desc, set: () => {} });
}

function getParser(filePath: string): import("tree-sitter") | null {
  const lang = detectLanguage(filePath);
  if (!lang) return null;
  const mod = PARSER_MODULES[lang.id];
  if (!mod) return null; // Task 3: unsupported language returns null
  if (parserCache.has(lang.id)) return parserCache.get(lang.id) ?? null;

  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
  if (isBun) {
    parserCache.set(lang.id, null);
    return null;
  }

  try {
    const ParserCtor = require_("tree-sitter") as typeof import("tree-sitter");
    const Lang = require_(mod) as import("tree-sitter").Language;
    ensureWritableTypeProperty(ParserCtor);
    const parser = new ParserCtor();
    parser.setLanguage(Lang);
    parserCache.set(lang.id, parser);
    return parser;
  } catch {
    parserCache.set(lang.id, null);
    return null;
  }
}

function countNodes(parser: import("tree-sitter"), source: string): NodeStats {
  const tree = parser.parse(source);
  const errors: Array<{ startLine: number; endLine: number }> = [];
  const missing: Array<{ startLine: number; endLine: number }> = [];
  const stack: import("tree-sitter").SyntaxNode[] = [tree.rootNode];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === "ERROR" || node.hasError && node.type === "ERROR") {
      errors.push({
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      });
    }
    if (node.isMissing) {
      missing.push({
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      });
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      const c = node.namedChild(i);
      if (c) stack.push(c);
    }
    // Also descend into anonymous children to find MISSING tokens.
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c && !c.isNamed) stack.push(c);
    }
  }
  return { errors, missing };
}

function dedupeSortLines(
  ranges: Array<{ startLine: number; endLine: number }>,
): string[] {
  const seen = new Set<string>();
  const out: Array<{ key: string; start: number }> = [];
  for (const r of ranges) {
    const key = r.startLine === r.endLine
      ? String(r.startLine)
      : `${r.startLine}-${r.endLine}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ key, start: r.startLine });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out.map((o) => o.key);
}

export async function validateSyntaxRegression(
  input: ValidateInput,
): Promise<ValidateResult | null> {
  const parser = getParser(input.filePath);
  if (!parser) return null;

  const beforeStats = input.before === undefined
    ? { errors: [], missing: [] }
    : countNodes(parser, input.before);
  const afterStats = countNodes(parser, input.after);

  // ±1 tolerance on ERROR count, no tolerance on MISSING.
  const newErrorCount = Math.max(
    0,
    afterStats.errors.length - beforeStats.errors.length - 1,
  );
  const newMissingCount = Math.max(
    0,
    afterStats.missing.length - beforeStats.missing.length,
  );

  if (newErrorCount === 0 && newMissingCount === 0) return null;

  const errorLines = dedupeSortLines([
    ...afterStats.errors,
    ...afterStats.missing,
  ]);
  return { errorLines, newErrorCount, newMissingCount };
}
