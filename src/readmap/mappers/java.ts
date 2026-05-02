import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";

import type { FileMap, FileSymbol } from "../types.js";
import { DetailLevel, SymbolKind } from "../enums.js";

export const MAPPER_VERSION = 2;

type SyntaxNode = import("tree-sitter").SyntaxNode;

const TYPE_KINDS: Record<string, SymbolKind> = {
  class_declaration: SymbolKind.Class,
  interface_declaration: SymbolKind.Interface,
  enum_declaration: SymbolKind.Enum,
  record_declaration: SymbolKind.Class,
  annotation_type_declaration: SymbolKind.Interface,
  module_declaration: SymbolKind.Module,
};

const SKIP_TYPES = new Set([
  "package_declaration",
  "import_declaration",
  "modifiers",
  "annotation",
  "marker_annotation",
  "local_variable_declaration",
]);


const MEMBER_METHOD_TYPES = new Set([
  "method_declaration",
  "constructor_declaration",
  "compact_constructor_declaration",
  "annotation_type_element_declaration",
]);

let parser: import("tree-sitter") | null = null;
let parserInitialized = false;

function ensureWritableTypeProperty(parserCtor: unknown): void {
  const syntaxNode = (parserCtor as { SyntaxNode?: { prototype?: object } }).SyntaxNode;
  const proto = syntaxNode?.prototype;
  if (!proto) return;
  const desc = Object.getOwnPropertyDescriptor(proto, "type");
  if (!desc || desc.set) return;
  Object.defineProperty(proto, "type", { ...desc, set: () => {} });
}

function getParser(): import("tree-sitter") | null {
  if (parserInitialized) return parser;
  parserInitialized = true;
  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") return null;

  try {
    const require = createRequire(import.meta.url);
    const ParserCtor = require("tree-sitter") as typeof import("tree-sitter");
    const JavaModule = require("tree-sitter-java") as import("tree-sitter").Language | { default: import("tree-sitter").Language };
    const Java = "default" in JavaModule ? JavaModule.default : JavaModule;
    ensureWritableTypeProperty(ParserCtor);
    parser = new ParserCtor();
    parser.setLanguage(Java);
    return parser;
  } catch {
    return null;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function getNodeText(node: SyntaxNode, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

function getLineRange(node: SyntaxNode): { startLine: number; endLine: number } {
  return { startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1 };
}

function extractName(node: SyntaxNode, source: string): string | null {
  const nameNode = node.childForFieldName("name");
  return nameNode ? normalizeWhitespace(getNodeText(nameNode, source)) : null;
}

function formatSignature(node: SyntaxNode, source: string, options?: { stripLeadingAnnotations?: boolean }): string {
  const body = node.childForFieldName("body");
  const end = body ? body.startIndex : node.endIndex;
  let signature = source.slice(node.startIndex, end).replace(/;\s*$/, "");
  if (options?.stripLeadingAnnotations && node.type !== "annotation_type_declaration") {
    signature = signature.replace(/^(?:\s*@[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\([^)]*\))?\s*)+/, "");
  }
  return normalizeWhitespace(signature);
}

function extractModifiers(node: SyntaxNode, source: string): string[] {
  const modifiers = node.namedChildren.find((child) => child.type === "modifiers");
  if (!modifiers) return [];
  const text = getNodeText(modifiers, source);
  return ["public", "protected", "private", "static", "final", "abstract", "native", "synchronized", "transient", "volatile", "strictfp", "default"]
    .filter((modifier) => new RegExp(`\\b${modifier}\\b`).test(text));
}

function extractImports(root: SyntaxNode, source: string): string[] {
  const imports: string[] = [];
  const visit = (node: SyntaxNode): void => {
    if (node.type === "package_declaration" || node.type === "import_declaration") {
      imports.push(normalizeWhitespace(getNodeText(node, source)));
      return;
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(root);
  return imports;
}

function buildSymbol(
  node: SyntaxNode,
  source: string,
  name: string,
  kind: SymbolKind,
  options?: { stripLeadingAnnotations?: boolean; modifiers?: string[] },
): FileSymbol {
  const modifiers = options?.modifiers ?? extractModifiers(node, source);
  const symbol: FileSymbol = {
    name,
    kind,
    ...getLineRange(node),
    signature: formatSignature(node, source, options),
    isExported: modifiers.includes("public"),
  };
  if (modifiers.length > 0) {
    symbol.modifiers = modifiers;
  }
  return symbol;
}

function variableDeclarators(node: SyntaxNode): SyntaxNode[] {
  return node.namedChildren.filter((child) => child.type === "variable_declarator");
}

function handleVariableDeclaration(node: SyntaxNode, source: string, parent: FileSymbol | undefined, rootSymbols: FileSymbol[]): void {
  const modifiers = extractModifiers(node, source);
  const kind = node.type === "constant_declaration" || (modifiers.includes("static") && modifiers.includes("final"))
    ? SymbolKind.Constant
    : SymbolKind.Property;

  for (const declarator of variableDeclarators(node)) {
    const name = extractName(declarator, source);
    if (!name) continue;
    const symbol = buildSymbol(declarator, source, name, kind, { modifiers });
    (parent ? (parent.children ??= []) : rootSymbols).push(symbol);
  }
}

function extractSymbols(root: SyntaxNode, source: string): FileSymbol[] {
  const rootSymbols: FileSymbol[] = [];

  const visit = (node: SyntaxNode, parent?: FileSymbol): void => {
    const typeKind = TYPE_KINDS[node.type];
    if (typeKind) {
      const name = extractName(node, source);
      if (!name) return;
      const symbol = buildSymbol(node, source, name, typeKind, { stripLeadingAnnotations: Boolean(parent) });
      (parent ? (parent.children ??= []) : rootSymbols).push(symbol);
      const body = node.childForFieldName("body");
      for (const child of body?.namedChildren ?? []) visit(child, symbol);
      return;
    }

    if (MEMBER_METHOD_TYPES.has(node.type)) {
      const name = extractName(node, source);
      if (!name) return;
      (parent ? (parent.children ??= []) : rootSymbols).push(buildSymbol(node, source, name, SymbolKind.Method));
      return;
    }

    if (node.type === "static_initializer") {
      (parent ? (parent.children ??= []) : rootSymbols).push(buildSymbol(node, source, "<clinit>", SymbolKind.Method));
      return;
    }


    if (node.type === "field_declaration" || node.type === "constant_declaration") {
      handleVariableDeclaration(node, source, parent, rootSymbols);
      return;
    }

    if (node.type === "enum_constant") {
      const name = extractName(node, source);
      if (!name) return;
      const symbol = buildSymbol(node, source, name, SymbolKind.Constant);
      (parent ? (parent.children ??= []) : rootSymbols).push(symbol);
      const body = node.childForFieldName("body");
      for (const child of body?.namedChildren ?? []) visit(child, symbol);
      return;
    }

    if (SKIP_TYPES.has(node.type)) return;
    for (const child of node.namedChildren) visit(child, parent);
  };

  visit(root);
  return rootSymbols;
}


export async function javaMapperFromContent(
  filePath: string,
  content: string,
  signal?: AbortSignal
): Promise<FileMap | null> {
  try {
    const p = getParser();
    if (!p) return null;
    if (signal?.aborted) return null;
    const tree = p.parse(content);
    const symbols = extractSymbols(tree.rootNode, content);
    if (symbols.length === 0) return null;
    return {
      path: filePath,
      totalLines: content.split("\n").length,
      totalBytes: Buffer.byteLength(content, "utf8"),
      language: "Java",
      symbols,
      imports: extractImports(tree.rootNode, content),
      detailLevel: DetailLevel.Full,
    };
  } catch (error) {
    if (signal?.aborted) return null;
    console.error(`Java content mapper failed: ${error}`);
    return null;
  }
}

export async function javaMapper(filePath: string, signal?: AbortSignal): Promise<FileMap | null> {
  try {
    const p = getParser();
    if (!p) return null;
    const stats = await stat(filePath);
    const content = await readFile(filePath, "utf8");
    if (signal?.aborted) return null;
    const tree = p.parse(content);
    const symbols = extractSymbols(tree.rootNode, content);
    if (symbols.length === 0) return null;
    return {
      path: filePath,
      totalLines: content.split("\n").length,
      totalBytes: stats.size,
      language: "Java",
      symbols,
      imports: extractImports(tree.rootNode, content),
      detailLevel: DetailLevel.Full,
    };
  } catch (error) {
    if (signal?.aborted) return null;
    console.error(`Java mapper failed: ${error}`);
    return null;
  }
}
