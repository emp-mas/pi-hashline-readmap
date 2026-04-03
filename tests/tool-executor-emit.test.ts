import { describe, it, expect, vi, beforeEach } from "vitest";

function createMockPi() {
  return {
    registerTool: vi.fn(),
    events: { emit: vi.fn(), on: vi.fn() },
    on: vi.fn(),
  };
}

describe("index.ts emits and stashes tool executors (task 2)", () => {
  beforeEach(() => {
    delete (globalThis as any).__hashlineToolExecutors;
  });

  it("stashes executors on globalThis with correct keys", async () => {
    const pi = createMockPi();
    const { default: init } = await import("../index.js");
    init(pi as any);
    const stash = (globalThis as any).__hashlineToolExecutors;
    expect(stash).toBeDefined();
    expect(Object.keys(stash).sort()).toEqual(["ast_search", "edit", "grep", "read", "write"]);
  });

  it("emit channel is exactly 'hashline:tool-executors'", async () => {
    const pi = createMockPi();
    const { default: init } = await import("../index.js");
    init(pi as any);
    const emitCall = pi.events.emit.mock.calls.find(
      (c: any[]) => c[0] === "hashline:tool-executors"
    );
    expect(emitCall).toBeDefined();
    expect(emitCall![1]).toBe((globalThis as any).__hashlineToolExecutors);
  });
});
