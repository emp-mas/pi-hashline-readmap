import { describe, expect, it } from "vitest";
import init from "../index.js";
import { buildBashCommandState } from "../src/bash-command-state.js";
import {
  buildCommandResource,
  buildContextHygieneMetadata,
  buildFileResource,
  getContextHygieneTracker,
} from "../src/context-hygiene.js";

function createHarness() {
  const handlers: Record<string, Function> = {};

  init(
    {
      registerTool() {},
      on(event: string, handler: Function) {
        handlers[event] = handler;
      },
      events: { emit() {}, on() {} },
    } as any,
  );

  return handlers;
}

describe("bash contextHygiene metadata", () => {
  it("attaches command-output metadata, records reruns, and preserves rendered output plus compressionInfo", async () => {
    const handlers = createHarness();
    const command = "npm test -- --context-hygiene-bash-task8";
    const expectedContextHygiene = {
      schemaVersion: 1,
      tool: "bash",
      classification: "command-output",
      resources: [buildCommandResource(command)],
      commandState: buildBashCommandState({ command, text: "PASS", isError: false }),
    };

    const first = await handlers.tool_result(
      {
        type: "tool_result" as const,
        toolName: "bash",
        toolCallId: "bash-hygiene-1",
        input: { command },
        content: [{ type: "text" as const, text: "\u001b[32mPASS\u001b[0m" }],
        isError: false,
        details: { existing: "kept" },
      },
      {},
    );
    const second = await handlers.tool_result(
      {
        type: "tool_result" as const,
        toolName: "bash",
        toolCallId: "bash-hygiene-2",
        input: { command },
        content: [{ type: "text" as const, text: "PASS" }],
        isError: false,
      },
      {},
    );

    expect(first).toBeDefined();
    expect(first.content).toEqual([{ type: "text", text: "PASS" }]);
    expect(first.details).toMatchObject({
      existing: "kept",
      compressionInfo: { technique: "test-output" },
    });
    expect(first.details.contextHygiene).toEqual(expectedContextHygiene);
    expect((first.details.ptcValue as any)?.contextHygiene).toBeUndefined();

    expect(second.details.contextHygiene).toEqual(expectedContextHygiene);

    const commandRerun = getContextHygieneTracker()
      .generateReport()
      .commandReruns.find((entry) => entry.resourceKey === buildCommandResource(command).key);

    expect(commandRerun).toEqual({
      resourceKey: "command:test:npm test -- --context-hygiene-bash-task8",
      count: 2,
      eventIds: expect.any(Array),
      resultIds: ["bash-hygiene-1", "bash-hygiene-2"],
    });
    expect(commandRerun?.eventIds).toHaveLength(2);
  });

  it("records contextHygiene metadata from non-bash tool_result events without changing the event", async () => {
    const handlers = createHarness();
    const metadata = buildContextHygieneMetadata({
      tool: "read",
      classification: "read-context",
      resources: [buildFileResource("tmp/context-hygiene-bash-non-bash.ts")],
    });

    const first = await handlers.tool_result(
      {
        type: "tool_result" as const,
        toolName: "read",
        toolCallId: "read-hygiene-1",
        input: { path: "tmp/context-hygiene-bash-non-bash.ts" },
        content: [{ type: "text" as const, text: "plain output" }],
        isError: false,
        details: { contextHygiene: metadata },
      },
      {},
    );
    const second = await handlers.tool_result(
      {
        type: "tool_result" as const,
        toolName: "read",
        toolCallId: "read-hygiene-2",
        input: { path: "tmp/context-hygiene-bash-non-bash.ts" },
        content: [{ type: "text" as const, text: "plain output" }],
        isError: false,
        details: { contextHygiene: metadata },
      },
      {},
    );

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();

    const readReuse = getContextHygieneTracker()
      .generateReport()
      .readReuse.find((entry) => entry.resourceKey === "file:tmp/context-hygiene-bash-non-bash.ts");

    expect(readReuse).toEqual({
      resourceKey: "file:tmp/context-hygiene-bash-non-bash.ts",
      count: 2,
      eventIds: expect.any(Array),
      resultIds: ["read-hygiene-1", "read-hygiene-2"],
    });
    expect(readReuse?.eventIds).toHaveLength(2);
  });


  it("handles bash tool_result events without input safely", async () => {
    const handlers = createHarness();

    expect(() => handlers.tool_result({
      type: "tool_result" as const,
      toolName: "bash",
      toolCallId: "bash-missing-input",
      content: [{ type: "text" as const, text: "plain output" }],
      isError: false,
    })).not.toThrow();

    const result = handlers.tool_result({
      type: "tool_result" as const,
      toolName: "bash",
      toolCallId: "bash-missing-input-2",
      content: [{ type: "text" as const, text: "plain output" }],
      isError: false,
    });

    expect(result).toMatchObject({
      content: [{ type: "text", text: "plain output" }],
      details: {
        contextHygiene: {
          schemaVersion: 1,
          tool: "bash",
          classification: "command-output",
          resources: [],
        },
      },
  });
  });


  it("ignores malformed non-bash contextHygiene metadata without polluting reports", async () => {
    const handlers = createHarness();
    const malformedMetadata = {
      schemaVersion: 1,
      tool: "read",
      classification: "read-context",
      resources: [null],
    };

    await handlers.tool_result({
      type: "tool_result" as const,
      toolName: "read",
      toolCallId: "malformed-hygiene-1",
      input: { path: "tmp/malformed.ts" },
      content: [{ type: "text" as const, text: "plain output" }],
      isError: false,
      details: { contextHygiene: malformedMetadata },
    });
    await handlers.tool_result({
      type: "tool_result" as const,
      toolName: "read",
      toolCallId: "malformed-hygiene-2",
      input: { path: "tmp/malformed.ts" },
      content: [{ type: "text" as const, text: "plain output" }],
      isError: false,
      details: { contextHygiene: malformedMetadata },
    });

    const report = getContextHygieneTracker().generateReport();
    expect(report.readReuse.some((entry) => (entry as any).resourceKey === undefined)).toBe(false);
  });
});
