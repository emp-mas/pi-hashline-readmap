import { describe, it, expect, vi, afterEach } from "vitest";

// Top-level mock that uses vi.importActual and allows per-test overrides
const fsMock = vi.hoisted(() => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: fsMock.mkdirSync,
    writeFileSync: fsMock.writeFileSync,
  };
});

function text(result: any): string {
  return result.content?.find((c: any) => c.type === "text")?.text ?? "";
}

function fsErr(code: string, msg: string): NodeJS.ErrnoException {
  const e: any = new Error(msg);
  e.code = code;
  return e;
}

async function getWriteTool(opts?: {
  mkdirSync?: () => void;
  writeFileSync?: () => void;
}) {
  const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
  // Default: passthrough to real fs
  fsMock.mkdirSync.mockImplementation(actualFs.mkdirSync);
  fsMock.writeFileSync.mockImplementation(actualFs.writeFileSync);
  // Apply test-specific overrides
  if (typeof opts?.mkdirSync === "function") {
    fsMock.mkdirSync.mockImplementation(opts.mkdirSync);
  }
  if (typeof opts?.writeFileSync === "function") {
    fsMock.writeFileSync.mockImplementation(opts.writeFileSync);
  }

  const { registerWriteTool } = await import("../src/write.js");
  let captured: any = null;
  registerWriteTool({ registerTool(def: any) { captured = def; } } as any);
  if (!captured) throw new Error("write tool was not registered");
  return captured;
}

describe("write fs-error mapping", () => {
  afterEach(() => {
    fsMock.mkdirSync.mockReset();
    fsMock.writeFileSync.mockReset();
  });

  it("EACCES on writeFile -> 'Permission denied — cannot write: <path>'", async () => {
    const tool = await getWriteTool({
      mkdirSync: () => {},
      writeFileSync: () => { throw fsErr("EACCES", "EACCES: permission denied"); },
    });
    const result = await tool.execute(
      "tc", { path: "/root/locked.txt", content: "hi" },
      new AbortController().signal, undefined, { cwd: process.cwd() },
    );
    expect(text(result)).toBe("Permission denied — cannot write: /root/locked.txt");
    expect(result.details?.ptcValue?.error?.code).toBe("permission-denied");
  });

  it("EPERM on writeFile -> same permission-denied mapping", async () => {
    const tool = await getWriteTool({
      mkdirSync: () => { throw fsErr("EPERM", "EPERM: operation not permitted"); },
      writeFileSync: () => { throw fsErr("EPERM", "EPERM: operation not permitted"); },
    });
    const result = await tool.execute(
      "tc", { path: "/root/locked2.txt", content: "hi" },
      new AbortController().signal, undefined, { cwd: process.cwd() },
    );
    expect(text(result)).toBe("Permission denied — cannot write: /root/locked2.txt");
    expect(result.details?.ptcValue?.error?.code).toBe("permission-denied");
  });

  it("EISDIR on writeFile -> 'Path is a directory — cannot overwrite: <path>'", async () => {
    const tool = await getWriteTool({
      mkdirSync: () => {},
      writeFileSync: () => { throw fsErr("EISDIR", "EISDIR: illegal operation on a directory"); },
    });
    const result = await tool.execute(
      "tc", { path: "/tmp/somedir", content: "hi" },
      new AbortController().signal, undefined, { cwd: process.cwd() },
    );
    expect(text(result)).toBe("Path is a directory — cannot overwrite: /tmp/somedir");
    expect(result.details?.ptcValue?.error?.code).toBe("path-is-directory");
  });

  it("ENOENT on mkdirSync -> 'Cannot create parent directories for <path>: <reason>'", async () => {
    const tool = await getWriteTool({
      mkdirSync: () => { throw fsErr("ENOENT", "ENOENT: parent does not exist"); },
    });
    const result = await tool.execute(
      "tc", { path: "/no/such/parent/file.txt", content: "hi" },
      new AbortController().signal, undefined, { cwd: process.cwd() },
    );
    expect(text(result)).toContain("Cannot create parent directories for /no/such/parent/file.txt");
    expect(text(result)).toContain("ENOENT: parent does not exist");
    expect(result.details?.ptcValue?.error?.code).toBe("fs-error");
  });

  it("ENOSPC on writeFile -> 'No space left on device — cannot write: <path>'", async () => {
    const tool = await getWriteTool({
      mkdirSync: () => { throw fsErr("ENOSPC", "ENOSPC: no space left"); },
      writeFileSync: () => { throw fsErr("ENOSPC", "ENOSPC: no space left"); },
    });
    const result = await tool.execute(
      "tc", { path: "/tmp/full.txt", content: "hi" },
      new AbortController().signal, undefined, { cwd: process.cwd() },
    );
    expect(text(result)).toBe("No space left on device — cannot write: /tmp/full.txt");
    expect(result.details?.ptcValue?.error?.code).toBe("fs-error");
  });

  it("EROFS on writeFile -> 'Read-only filesystem — cannot write: <path>'", async () => {
    const tool = await getWriteTool({
      mkdirSync: () => { throw fsErr("EROFS", "EROFS: read-only file system"); },
      writeFileSync: () => { throw fsErr("EROFS", "EROFS: read-only file system"); },
    });
    const result = await tool.execute(
      "tc", { path: "/readonly/file.txt", content: "hi" },
      new AbortController().signal, undefined, { cwd: process.cwd() },
    );
    expect(text(result)).toBe("Read-only filesystem — cannot write: /readonly/file.txt");
    expect(result.details?.ptcValue?.error?.code).toBe("fs-error");
  });

  it("regression: successful write still returns hashlined output", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "write-ok-"));
    try {
      const tool = await getWriteTool();
      const result = await tool.execute(
        "tc", { path: join(dir, "ok.txt"), content: "hello\nworld" },
        new AbortController().signal, undefined, { cwd: process.cwd() },
      );
      expect(result.isError).toBeFalsy();
      expect(text(result)).toMatch(/^1:[0-9a-f]{3}\|hello$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
