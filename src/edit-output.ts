import { buildPtcEditResult, type SemanticSummary } from "./ptc-value.js";

export interface BuildEditOutputInput {
  path: string;
  displayPath: string;
  diff: string;
  firstChangedLine: number | undefined;
  warnings: string[];
  noopEdits: unknown[];
  semanticSummary?: SemanticSummary;
}

export interface EditOutputResult {
  text: string;
  ptcValue: ReturnType<typeof buildPtcEditResult>;
}

export function buildEditOutput(input: BuildEditOutputInput): EditOutputResult {
  const summary = `Updated ${input.displayPath}`;
  const warningText = input.warnings.length ? `\n\nWarnings:\n${input.warnings.join("\n")}` : "";
  return {
    text: `${summary}${warningText}`,
    ptcValue: buildPtcEditResult({
      path: input.path,
      summary,
      diff: input.diff,
      firstChangedLine: input.firstChangedLine,
      warnings: input.warnings,
      noopEdits: input.noopEdits,
      ...(input.semanticSummary ? { semanticSummary: input.semanticSummary } : {}),
    }),
  };
}
