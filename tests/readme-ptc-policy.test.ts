import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

describe("README.md ptc policy docs", () => {
  const readme = readFileSync(resolve(root, "README.md"), "utf8");

  it("documents the exported policy contract and recommended exposure tiers", () => {
    expect(readme).toContain("### PTC tool policy contract");
    expect(readme).toContain("`HASHLINE_TOOL_PTC_POLICY`");
    expect(readme).toContain("`read` and `grep` are safe-by-default");
    expect(readme).toContain("`sg` is opt-in");
    expect(readme).toContain("`edit` is not safe-by-default");
    expect(readme).toContain("`pi-prompt-assembler` may optionally consume this contract");
  });
});
