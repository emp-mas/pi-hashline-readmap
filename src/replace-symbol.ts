import { generateMap } from "./readmap/mapper.js";
import { findSymbol } from "./readmap/symbol-lookup.js";
import { formatAmbiguous, formatNotFound } from "./readmap/symbol-error-format.js";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface ReplaceSymbolInput {
	filePath: string;
	content: string;
	symbol: string;
	newBody: string;
}

export type ReplaceSymbolResult =
	| { type: "ok"; content: string; warnings: string[]; range: { start: number; end: number } }
	| { type: "not-found"; message: string }
	| { type: "ambiguous"; message: string };

function detectIndent(line: string): string {
	return line.match(/^\s*/)?.[0] ?? "";
}

function dedent(text: string): string {
	const lines = text.split("\n");
	const nonEmpty = lines.filter((l) => l.trim().length);
	if (!nonEmpty.length) return text;
	const minIndent = Math.min(...nonEmpty.map((l) => l.match(/^\s*/)?.[0].length ?? 0));
	return lines.map((l) => l.slice(minIndent)).join("\n");
}

function reindent(text: string, indent: string): string {
	return text.split("\n").map((l) => (l.length ? indent + l : l)).join("\n");
}

export async function replaceSymbol(input: ReplaceSymbolInput): Promise<ReplaceSymbolResult> {
	const dir = mkdtempSync(join(tmpdir(), "rs-"));
	const ext = input.filePath.match(/\.[^./\\]+$/)?.[0] ?? "";
	const tmp = join(dir, "in" + ext);
	writeFileSync(tmp, input.content);
	const map = await generateMap(tmp);
	if (!map) {
		return { type: "not-found", message: `[Warning: symbol '${input.symbol}' not found. Available symbols: ]` };
	}
	const lookup = findSymbol(map, input.symbol);
	if (lookup.type === "not-found") {
		return { type: "not-found", message: formatNotFound(input.symbol, map) };
	}
	if (lookup.type === "ambiguous") {
		return { type: "ambiguous", message: formatAmbiguous(input.symbol, lookup.candidates) };
	}
	const sym = lookup.symbol;
	const lines = input.content.split("\n");
	const sigLine = lines[sym.startLine - 1] ?? "";
	const indent = detectIndent(sigLine);
	const reindented = reindent(dedent(input.newBody), indent);
	const warnings: string[] = [];
	const leaf = input.symbol.replace(/@\d+$/, "").split(".").pop() ?? "";
	const firstDeclName =
		reindented.match(/\b(?:function|class|method|const|let|var)\s+([A-Za-z_$][\w$]*)/)?.[1]
		?? reindented.match(/^\s*(?:[\w$<>,?\s]+\s+)?([A-Za-z_$][\w$]*)\s*\(/)?.[1];
	if (leaf && firstDeclName && firstDeclName !== leaf) {
		warnings.push(`name-mismatch: expected ${leaf}, got ${firstDeclName}`);
	}
	const before = lines.slice(0, sym.startLine - 1).join("\n");
	const after = lines.slice(sym.endLine).join("\n");
	const beforePart = before.length ? before + "\n" : "";
	const afterPart = after.length ? "\n" + after : "";
	const newContent = beforePart + reindented + afterPart;
	return {
		type: "ok",
		content: newContent,
		warnings,
		range: { start: sym.startLine, end: sym.endLine },
	};
}
