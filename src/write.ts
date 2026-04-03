import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { ensureHashInit, formatHashlineDisplay } from "./hashline.js";
import { buildPtcLine, buildPtcWarning, type PtcLine, type PtcWarning } from "./ptc-value.js";
import { looksLikeBinary } from "./binary-detect.js";
import { getOrGenerateMap } from "./map-cache.js";
import { formatFileMapWithBudget } from "./readmap/formatter.js";

const MAX_LINES = 2000;
const MAX_BYTES = 50 * 1024;

export interface WriteResult {
  text: string;
  warnings: string[];
  ptcValue: {
    tool: "write";
    path: string;
    lines: PtcLine[];
    warnings: PtcWarning[];
    map?: { appended: boolean };
  };
}

export async function executeWrite(opts: {
  path: string;
  content: string;
  map?: boolean;
  cwd?: string;
}): Promise<WriteResult> {
  await ensureHashInit();

  const { path: filePath, content, map: requestMap, cwd } = opts;

  // Create parent directories
  mkdirSync(dirname(filePath), { recursive: true });

  // Write file
  writeFileSync(filePath, content, "utf-8");

  const warnings: string[] = [];
  const ptcWarnings: PtcWarning[] = [];

  // Binary detection
  if (looksLikeBinary(Buffer.from(content, "utf-8"))) {
    warnings.push("File content appears to be binary.");
    ptcWarnings.push(buildPtcWarning("binary", "File content appears to be binary."));
    return {
      text: `Wrote ${filePath}\n⚠️ File content appears to be binary — hashlines not generated.`,
      warnings,
      ptcValue: {
        tool: "write",
        path: filePath,
        lines: [],
        warnings: ptcWarnings,
      },
    };
  }

  // Compute hashlines
  const rawLines = content.split("\n");
  const ptcLines: PtcLine[] = [];
  const displayLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const ptcLine = buildPtcLine(lineNum, rawLines[i]);
    ptcLines.push(ptcLine);
    displayLines.push(formatHashlineDisplay(lineNum, rawLines[i]));
  }

  let text = displayLines.join("\n");

  // Truncation
  if (rawLines.length > MAX_LINES) {
    text = displayLines.slice(0, MAX_LINES).join("\n");
    text += `\n[… ${rawLines.length - MAX_LINES} more lines truncated]`;
  }
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_BYTES) {
    text = Buffer.from(text, "utf8").subarray(0, MAX_BYTES).toString("utf8");
    text += "\n[… truncated at 50 KB]";
  }

  // Optional structural map
  let mapAppended = false;
  if (requestMap) {
    try {
      const fileMap = await getOrGenerateMap(filePath);
      if (fileMap) {
        const mapText = formatFileMapWithBudget(fileMap);
        if (mapText) {
          text += "\n\n" + mapText;
          mapAppended = true;
        }
      }
    } catch {
      // Map generation failure is non-fatal
    }
  }

  const displayPath = cwd ? relative(cwd, filePath) || filePath : filePath;

  return {
    text,
    warnings,
    ptcValue: {
      tool: "write",
      path: displayPath,
      lines: ptcLines,
      warnings: ptcWarnings,
      ...(requestMap !== undefined ? { map: { appended: mapAppended } } : {}),
    },
  };
}

export function registerWriteTool(pi: ExtensionAPI) {
  const tool = {
    name: "write",
    label: "write",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories. Returns hashlined content with LINE:HASH anchors for immediate use with edit.",
    parameters: Type.Object({
      path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
      content: Type.String({ description: "Content to write to the file" }),
      map: Type.Optional(Type.Boolean({ description: "Append structural map to output" })),
    }),

    async execute(_toolCallId: string, params: { path: string; content: string; map?: boolean }, _signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
      const result = await executeWrite({
        path: params.path,
        content: params.content,
        map: params.map,
        cwd: ctx?.cwd,
      });

      return {
        content: [{ type: "text" as const, text: result.text }],
        details: {
          ptcValue: result.ptcValue,
          warnings: result.warnings,
        },
      };
    },

    renderCall(args: any, theme: any) {
      const { path } = args as { path: string };
      const label = theme.fg("toolTitle", "✏️ write");
      return new Text(`${label} ${theme.fg("muted", path)}`, 0, 0);
    },

    renderResult(result: any, _options: any, theme: any) {
      const output = result.content[0]?.type === "text"
        ? (result.content[0] as { type: "text"; text: string }).text
        : "";
      const lineCount = output.split("\n").filter((l: string) => /^\d+:[0-9a-f]{3}\|/.test(l)).length;
      const summary = lineCount > 0 ? `${lineCount} lines written` : "written";
      return new Text(theme.fg("toolOutput", summary), 0, 0);
    },
  };

  pi.registerTool(tool);
  return tool;
}
