/**
 * Perl mapper using regex-based extraction.
 *
 * Extracts packages, subroutines, lifecycle blocks, constants, and imports.
 * Handles POD blocks (skipped) and __END__/__DATA__ (stop parsing).
 * No external dependencies — pure regex with brace-depth tracking.
 */
import { readFile, stat } from "node:fs/promises";

import type { FileMap, FileSymbol } from "../types.js";

import { DetailLevel, SymbolKind } from "../enums.js";

export const MAPPER_VERSION = 1;

// package My::Module;
const PACKAGE_RE = /^\s*package\s+([\w::]+)\s*;\s*$/;

// sub name { ... } or sub name($@) { ... }
const SUB_RE = /^\s*sub\s+(\w+)\s*(?:\(([^)]*)\))?\s*\{?\s*$/;

// BEGIN { }, END { }, CHECK { }, INIT { }, UNITCHECK { }
const LIFECYCLE_RE = /^\s*(BEGIN|END|CHECK|INIT|UNITCHECK)\s*\{?\s*$/;

// use constant NAME => value;
const CONSTANT_RE = /^\s*use\s+constant\s+(\w+)\s*=>/;

// use Module; or use Module qw(...);
const USE_RE = /^\s*use\s+([\w::]+)/;

// require Module;
const REQUIRE_RE = /^\s*require\s+([\w::]+)\s*;/;

// POD block start: =pod, =head1, =over, etc.
const POD_START_RE = /^\s*=\w+/;

// POD block end: =cut
const POD_END_RE = /^\s*=cut\s*$/;

// __END__ or __DATA__ — stop parsing entirely
const END_MARKER_RE = /^\s*__(END|DATA)__/;

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

/** Perl keywords that look like sub names but aren't */
function isPerlKeyword(name: string): boolean {
  const keywords = new Set([
    "if", "unless", "else", "elsif", "while", "until", "for", "foreach",
    "do", "given", "when", "default", "continue", "return", "last",
    "next", "redo", "goto", "die", "warn", "exit", "eval", "local",
    "my", "our", "state", "use", "require", "package", "sub", "print",
    "printf", "chomp", "chmod", "chown", "unlink", "mkdir", "rmdir",
    "open", "close", "read", "write", "seek", "tell", "binmode",
    "bless", "ref", "tie", "untie", "sort", "reverse", "map", "grep",
    "join", "split", "substr", "index", "rindex", "length", "uc", "lc",
    "ucfirst", "lcfirst", "ord", "chr", "hex", "oct", "int", "rand",
    "time", "localtime", "gmtime", "sleep", "alarm", "syscall",
    "defined", "undef", "exists", "delete", "keys", "values", "each",
    "push", "pop", "shift", "unshift", "splice", "scalar", "list",
    "lock", "threads", "Thread",
  ]);
  return keywords.has(name);
}

/**
 * Generate a file map for a Perl file.
 */
export async function perlMapper(
  filePath: string,
  signal?: AbortSignal,
): Promise<FileMap | null> {
  try {
    const stats = await stat(filePath);
    const totalBytes = stats.size;

    const content = await readFile(filePath, "utf8");

    if (signal?.aborted) return null;

    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;
    const symbols: FileSymbol[] = [];
    const imports: string[] = [];

    let braceDepth = 0;
    const declStack: { symbol: FileSymbol; startDepth: number }[] = [];
    let inPod = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Stop at __END__ or __DATA__
      if (END_MARKER_RE.test(trimmed)) {
        break;
      }

      // Handle POD blocks: skip everything from =word to =cut
      if (inPod) {
        if (POD_END_RE.test(trimmed)) {
          inPod = false;
        }
        continue;
      }
      if (POD_START_RE.test(trimmed)) {
        inPod = true;
        continue;
      }

      // Skip comments and empty lines for symbol detection
      if (trimmed.startsWith("#") || trimmed === "") {
        continue;
      }

      // Try package declaration
      const pkgMatch = trimmed.match(PACKAGE_RE);
      if (pkgMatch) {
        symbols.push({
          name: pkgMatch[1],
          kind: SymbolKind.Module,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed,
        });
        continue;
      }

      // Try lifecycle blocks (BEGIN, END, CHECK, INIT, UNITCHECK)
      const lifecycleMatch = trimmed.match(LIFECYCLE_RE);
      if (lifecycleMatch) {
        const name = lifecycleMatch[1];
        const sym: FileSymbol = {
          name,
          kind: SymbolKind.Function,
          startLine: lineNum,
          endLine: lineNum,
          signature: name,
        };

        const openBraces = countChar(line, "{");
        const closeBraces = countChar(line, "}");

        if (openBraces > closeBraces) {
          declStack.push({ symbol: sym, startDepth: braceDepth });
        } else {
          sym.endLine = lineNum;
        }

        symbols.push(sym);
        braceDepth += openBraces - closeBraces;
        continue;
      }

      // Try subroutine declaration
      const subMatch = trimmed.match(SUB_RE);
      if (subMatch) {
        const name = subMatch[1];
        if (!isPerlKeyword(name)) {
          const params = subMatch[2];
          const sig = params
            ? `${name}(${params})`
            : name;
          const sym: FileSymbol = {
            name,
            kind: SymbolKind.Function,
            startLine: lineNum,
            endLine: lineNum,
            signature: sig,
          };

          const openBraces = countChar(line, "{");
          const closeBraces = countChar(line, "}");

          if (openBraces > closeBraces) {
            declStack.push({ symbol: sym, startDepth: braceDepth });
          } else {
            sym.endLine = lineNum;
          }

          symbols.push(sym);
          braceDepth += openBraces - closeBraces;
          continue;
        }
      }

      // Try use constant NAME => value
      const constMatch = trimmed.match(CONSTANT_RE);
      if (constMatch) {
        symbols.push({
          name: constMatch[1],
          kind: SymbolKind.Constant,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed,
        });
        continue;
      }

      // Collect imports (use Module / require Module)
      const useMatch = trimmed.match(USE_RE);
      if (useMatch) {
        const moduleName = useMatch[1];
        // Skip "use constant" — that's handled above
        if (trimmed.startsWith("use constant")) {
          // already handled
        } else if (!imports.includes(moduleName)) {
          imports.push(moduleName);
        }
        continue;
      }

      const reqMatch = trimmed.match(REQUIRE_RE);
      if (reqMatch) {
        const moduleName = reqMatch[1];
        if (!imports.includes(moduleName)) {
          imports.push(moduleName);
        }
        continue;
      }

      // Track braces for non-declaration lines
      const openBraces = countChar(line, "{");
      const closeBraces = countChar(line, "}");
      braceDepth += openBraces - closeBraces;

      // Pop closed declarations
      while (declStack.length > 0) {
        const top = declStack[declStack.length - 1];
        if (braceDepth <= top.startDepth) {
          top.symbol.endLine = lineNum;
          declStack.pop();
        } else {
          break;
        }
      }
    }

    // Close any remaining open declarations
    for (const item of declStack) {
      item.symbol.endLine = totalLines;
    }

    if (symbols.length === 0) return null;

    return {
      path: filePath,
      totalLines,
      totalBytes,
      language: "Perl",
      symbols,
      imports,
      detailLevel: DetailLevel.Full,
    };
  } catch (error) {
    if (signal?.aborted) return null;
    console.error(`Perl mapper failed: ${error}`);
    return null;
  }
}
