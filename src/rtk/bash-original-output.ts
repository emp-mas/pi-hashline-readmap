import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

export type BashOriginalOutputSource = "pi-full-output-path" | "pi-visible-fallback" | "pi-visible";

export interface BashOriginalOutputMetadata {
  enabled: boolean;
  source: BashOriginalOutputSource;
  restoredContentForRtk: boolean;
  originalPath?: string;
  snapshotNeeded: boolean;
  snapshotWritten: boolean;
  snapshotPath?: string;
  originalLineCount: number;
  originalByteCount: number;
  visibleLineCount: number;
  visibleByteCount: number;
  fullOutputReadError?: string;
  snapshotWriteError?: string;
}

export interface BashOriginalOutputFs {
  readFile(path: string): string;
  writeFile(path: string, content: string, options: { mode: number; flag: string }): void;
  randomId(): string;
  tempDir(): string;
}

export interface SelectBashOriginalOutputOptions {
  visibleText: string;
  fullOutputPath?: unknown;
  snapshotMaxLines?: number;
  snapshotMaxBytes?: number;
  enabled?: boolean;
  fs?: Partial<BashOriginalOutputFs>;
}

export interface BashOriginalOutputSelection {
  inputForRtk: string;
  metadata?: BashOriginalOutputMetadata;
}

const DEFAULT_SNAPSHOT_MAX_LINES = 2000;
const DEFAULT_SNAPSHOT_MAX_BYTES = 50 * 1024;


function defaultFs(): BashOriginalOutputFs {
  return {
    readFile: (path) => readFileSync(path, "utf8"),
    writeFile: (path, content, options) => writeFileSync(path, content, options),
    randomId: () => randomUUID(),
    tempDir: () => tmpdir(),
  };
}

function mergeFs(overrides: Partial<BashOriginalOutputFs> | undefined): BashOriginalOutputFs {
  return { ...defaultFs(), ...(overrides ?? {}) };
}

function lineCount(text: string): number {
  return text === "" ? 0 : text.split("\n").length;
}

function byteCount(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

export function extractVisibleFullOutputPath(visibleText: string): string | undefined {
  const match = visibleText.match(/Full output:\s*([^\]\r\n]+)/);
  return match?.[1]?.trim() || undefined;
}

function writeSnapshot(fs: BashOriginalOutputFs, visibleText: string): string {
  const path = join(fs.tempDir(), `hashline-bash-original-${fs.randomId()}.txt`);
  fs.writeFile(path, visibleText, { mode: 0o600, flag: "wx" });
  return path;
}

export function selectBashOriginalOutput(options: SelectBashOriginalOutputOptions): BashOriginalOutputSelection {
  const enabled = options.enabled !== false;
  const visibleText = options.visibleText;
  if (!enabled) return { inputForRtk: visibleText };
  const fs = mergeFs(options.fs);
  const visibleLineCount = lineCount(visibleText);
  const visibleByteCount = byteCount(visibleText);
  const metadataPath = typeof options.fullOutputPath === "string" ? options.fullOutputPath : undefined;
  const visibleNoticePath = extractVisibleFullOutputPath(visibleText);
  const fullOutputPath = metadataPath ?? visibleNoticePath;

  let fallbackSource: BashOriginalOutputSource = "pi-visible";
  let fullOutputReadError: string | undefined;
  if (fullOutputPath) {
    try {
      const fullText = fs.readFile(fullOutputPath);
      return {
        inputForRtk: fullText,
        metadata: {
          enabled: true,
          source: "pi-full-output-path",
          restoredContentForRtk: true,
          originalPath: fullOutputPath,
          snapshotNeeded: false,
          snapshotWritten: false,
          originalLineCount: lineCount(fullText),
          originalByteCount: byteCount(fullText),
          visibleLineCount,
          visibleByteCount,
        },
      };
    } catch (error) {
      fallbackSource = "pi-visible-fallback";
      fullOutputReadError = error instanceof Error ? error.message : String(error);
    }
  }

  if (visibleText === "") return { inputForRtk: visibleText };

  const snapshotMaxLines = options.snapshotMaxLines ?? DEFAULT_SNAPSHOT_MAX_LINES;
  const snapshotMaxBytes = options.snapshotMaxBytes ?? DEFAULT_SNAPSHOT_MAX_BYTES;
  const snapshotNeeded = visibleLineCount > snapshotMaxLines || visibleByteCount > snapshotMaxBytes;
  let snapshotPath: string | undefined;
  let snapshotWritten = false;
  let snapshotWriteError: string | undefined;
  if (snapshotNeeded) {
    try {
      snapshotPath = writeSnapshot(fs, visibleText);
      snapshotWritten = true;
    } catch (error) {
      snapshotWriteError = error instanceof Error ? error.message : String(error);
      snapshotPath = undefined;
    }
  }

  const metadata: BashOriginalOutputMetadata = {
    enabled: true,
    source: fallbackSource,
    restoredContentForRtk: false,
    snapshotNeeded,
    snapshotWritten,
    snapshotPath,
    originalPath: snapshotPath,
    originalLineCount: visibleLineCount,
    originalByteCount: visibleByteCount,
    visibleLineCount,
    visibleByteCount,
    fullOutputReadError,
    snapshotWriteError,
  };

  return { inputForRtk: visibleText, metadata };
}
