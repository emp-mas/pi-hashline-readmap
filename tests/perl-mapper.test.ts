import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMap } from "../src/readmap/mapper.js";
import { SymbolKind } from "../src/readmap/enums.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, "fixtures/sample.pl");

describe("Perl readmap mapper", () => {
  it("generates a map for .pl files", async () => {
    const map = await generateMap(FIXTURE);
    expect(map).not.toBeNull();
    expect(map!.language).toBe("Perl");
    expect(map!.symbols.length).toBeGreaterThan(0);
  });

  it("extracts package as Module", async () => {
    const map = await generateMap(FIXTURE);
    const pkg = map!.symbols.find(s => s.name === "MyApp::Service");
    expect(pkg).toBeDefined();
    expect(pkg!.kind).toBe(SymbolKind.Module);
  });

  it("extracts sub as Function", async () => {
    const map = await generateMap(FIXTURE);
    const newSub = map!.symbols.find(s => s.name === "new");
    expect(newSub).toBeDefined();
    expect(newSub!.kind).toBe(SymbolKind.Function);
    expect(newSub!.startLine).toBeGreaterThan(0);
    expect(newSub!.endLine).toBeGreaterThanOrEqual(newSub!.startLine);

    const processSub = map!.symbols.find(s => s.name === "process_data");
    expect(processSub).toBeDefined();
    expect(processSub!.kind).toBe(SymbolKind.Function);

    const internalSub = map!.symbols.find(s => s.name === "_internal_helper");
    expect(internalSub).toBeDefined();
    expect(internalSub!.kind).toBe(SymbolKind.Function);
  });

  it("extracts lifecycle blocks as Function", async () => {
    const map = await generateMap(FIXTURE);
    const begin = map!.symbols.find(s => s.name === "BEGIN");
    expect(begin).toBeDefined();
    expect(begin!.kind).toBe(SymbolKind.Function);

    const end = map!.symbols.find(s => s.name === "END");
    expect(end).toBeDefined();
    expect(end!.kind).toBe(SymbolKind.Function);
  });

  it("extracts use constant as Constant", async () => {
    const map = await generateMap(FIXTURE);
    const maxRetries = map!.symbols.find(s => s.name === "MAX_RETRIES");
    expect(maxRetries).toBeDefined();
    expect(maxRetries!.kind).toBe(SymbolKind.Constant);

    const version = map!.symbols.find(s => s.name === "VERSION");
    expect(version).toBeDefined();
    expect(version!.kind).toBe(SymbolKind.Constant);
  });

  it("captures use/require as imports", async () => {
    const map = await generateMap(FIXTURE);
    expect(map!.imports).toContain("strict");
    expect(map!.imports).toContain("warnings");
    expect(map!.imports).toContain("Data::Dumper");
    expect(map!.imports).toContain("JSON::PP");
    expect(map!.imports).toContain("My::Helper");
  });

  it("skips POD blocks", async () => {
    const map = await generateMap(FIXTURE);
    // No symbols should be extracted from inside the POD block
    const podSymbols = map!.symbols.filter(s => s.startLine >= 13 && s.startLine <= 19);
    expect(podSymbols.length).toBe(0);
  });

  it("stops at __END__", async () => {
    const map = await generateMap(FIXTURE);
    const fakeSub = map!.symbols.find(s => s.name === "fake_sub");
    expect(fakeSub).toBeUndefined();
  });

  it("handles .pm extension", async () => {
    // Copy the fixture to .pm and test
    const pmFixture = FIXTURE.replace(".pl", ".pm");
    const { writeFileSync, unlinkSync, existsSync } = await import("node:fs");
    const { readFileSync } = await import("node:fs");
    writeFileSync(pmFixture, readFileSync(FIXTURE, "utf8"));
    try {
      const map = await generateMap(pmFixture);
      expect(map).not.toBeNull();
      expect(map!.language).toBe("Perl");
      expect(map!.symbols.length).toBeGreaterThan(0);
    } finally {
      if (existsSync(pmFixture)) {
        unlinkSync(pmFixture);
      }
    }
  });

  it("signature includes prototypes", async () => {
    const map = await generateMap(FIXTURE);
    const processSub = map!.symbols.find(s => s.name === "process_data");
    expect(processSub).toBeDefined();
    expect(processSub!.signature).toContain("$self");
    expect(processSub!.signature).toContain("$file");
  });

  it("tracks Allman-style sub with brace on next line", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "pi-perl-allman-"));
    const filePath = join(dir, "allman.pl");
    writeFileSync(
      filePath,
      [
        "package AllmanTest;",
        "",
        "sub allman_sub",
        "{",
        "    my $x = 1;",
        "    return $x;",
        "}",
        "",
        "BEGIN",
        "{",
        '    print "start\\n";',
        "}",
        "",
        "1;",
      ].join("\n"),
      "utf8",
    );
    try {
      const map = await generateMap(filePath);
      const sub = map!.symbols.find(s => s.name === "allman_sub");
      expect(sub).toBeDefined();
      expect(sub!.startLine).toBe(3);
      expect(sub!.endLine).toBe(7);

      const begin = map!.symbols.find(s => s.name === "BEGIN");
      expect(begin).toBeDefined();
      expect(begin!.startLine).toBe(9);
      expect(begin!.endLine).toBe(12);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("ignores braces inside strings and regexes", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "pi-perl-braces-"));
    const filePath = join(dir, "braces.pl");
    writeFileSync(
      filePath,
      [
        "package BraceTest;",
        "",
        "sub string_braces {",
        '    my $tpl = "hello {world}";',
        "    my $str = 'foo {bar}';",
        "    my $cmd = `echo {test}`;",
        "    my $re = /foo \\{/;",
        "    return 1;",
        "}",
        "",
        "sub regex_braces {",
        "    my $re = /foo {/;",
        "    return 1;",
        "}",
        "",
        "1;",
      ].join("\n"),
      "utf8",
    );
    try {
      const map = await generateMap(filePath);
      const sub1 = map!.symbols.find(s => s.name === "string_braces");
      expect(sub1).toBeDefined();
      expect(sub1!.startLine).toBe(3);
      expect(sub1!.endLine).toBe(9);

      const sub2 = map!.symbols.find(s => s.name === "regex_braces");
      expect(sub2).toBeDefined();
      expect(sub2!.startLine).toBe(11);
      expect(sub2!.endLine).toBe(14);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
