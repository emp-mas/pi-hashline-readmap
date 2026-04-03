/**
 * Swift mapper using regex-based extraction.
 *
 * Extracts classes, structs, enums, protocols, extensions, and functions.
 * No external dependencies — pure regex with brace-depth tracking.
 */
import { readFile, stat } from "node:fs/promises";

import type { FileMap, FileSymbol } from "../types.js";

import { DetailLevel, SymbolKind } from "../enums.js";

// Regex for Swift declarations (handles access modifiers and attributes)
const SWIFT_DECL_RE =
  /^(?:\s*)(?:@\w+\s+)*(?:(?:public|private|internal|open|fileprivate)\s+)?(?:(?:final|static|override|class|mutating|nonmutating)\s+)*(class|struct|enum|protocol|extension|func)\s+(\w+)/;

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

/**
 * Generate a file map for a Swift file.
 */
export async function swiftMapper(
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

    let braceDepth = 0;
    const declStack: { symbol: FileSymbol; startDepth: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      if (trimmed.startsWith("//")) continue;

      const match = trimmed.match(SWIFT_DECL_RE);
      if (match) {
        const keyword = match[1];
        const name = match[2];

        let kind: SymbolKind;
        switch (keyword) {
          case "class":
          case "struct":
          case "extension":
            kind = SymbolKind.Class;
            break;
          case "enum":
            kind = SymbolKind.Enum;
            break;
          case "protocol":
            kind = SymbolKind.Interface;
            break;
          case "func":
            kind = braceDepth > 0 ? SymbolKind.Method : SymbolKind.Function;
            break;
          default:
            kind = SymbolKind.Unknown;
        }

        const sym: FileSymbol = {
          name,
          kind,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.replace(/\{.*$/, "").trim(),
        };

        // Determine parent BEFORE pushing this symbol
        const isChild = declStack.length > 0 && keyword === "func";
        const parentEntry = isChild ? declStack[declStack.length - 1] : null;

        const openBraces = countChar(line, "{");
        const closeBraces = countChar(line, "}");

        if (openBraces > closeBraces) {
          declStack.push({ symbol: sym, startDepth: braceDepth });
        } else {
          sym.endLine = lineNum;
        }

        if (isChild && parentEntry) {
          if (!parentEntry.symbol.children) parentEntry.symbol.children = [];
          parentEntry.symbol.children.push(sym);
        } else {
          symbols.push(sym);
        }

        braceDepth += openBraces - closeBraces;
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
      language: "Swift",
      symbols,
      imports: [],
      detailLevel: DetailLevel.Full,
    };
  } catch (error) {
    if (signal?.aborted) return null;
    console.error(`Swift mapper failed: ${error}`);
    return null;
  }
}
