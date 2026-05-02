Surgically edit files with hash-verified line references (anchors). Copy `LINE:HASH` strings exactly from `read`, `grep`, `ast_search`, or `write` output and use them to make precise changes.

## What edit does
`edit` applies one or more changes to an existing text file using hash-verified anchors. Anchored operations are verified against the current file contents before they are written.

## The five edit variants — when to use which

| Variant | Use for | Anchors needed |
|---|---|---|
| `set_line` | Replace or delete exactly one line | 1 |
| `replace_lines` | Replace or delete a contiguous range of lines | 2 |
| `insert_after` | Insert new lines after an existing line | 1 |
| `replace_symbol` | Replace an entire symbol declaration by name | 0 (uses `symbol`) |
| `replace` | Fallback global string replacement | 0 |

### Prefer anchored variants
`set_line`, `replace_lines`, and `insert_after` use `LINE:HASH` anchors and verify that the file still matches the content you saw earlier.
`edit` also requires the target file to have been anchored earlier in the current session. If it says the file was not read, run `read`, `grep`, `ast_search`, or `write` first to produce fresh anchors for that file.

### `replace` is the escape hatch
`replace` does not use anchors and does not verify exact line positions. Use it only when an anchored edit is not practical, such as a repeated string replacement across many unrelated lines.

## Input format

```json
{
  "path": "src/foo.ts",
  "edits": [
    { "set_line": { "anchor": "42:ab1", "new_text": "const x = 2;" } },
    { "replace_lines": { "start_anchor": "50:c3d", "end_anchor": "55:e4f", "new_text": "const y = 3;\nreturn y;" } },
    { "insert_after": { "anchor": "60:f5a", "new_text": "// TODO: revisit\n" } },
    { "replace": { "old_text": "value", "new_text": "result", "all": true } }
  ]
}
```

- `path` is the file to edit
- `edits` is an array of edit operations
- Each edit entry must contain exactly one of `set_line`, `replace_lines`, `insert_after`, `replace_symbol`, or `replace`
- `new_text` is plain content — do not include hash prefixes or diff markers

## Variant examples

### `set_line`
Use `set_line` when you are changing one existing line.

```text
edit({
  path: "src/foo.ts",
  edits: [
    { set_line: { anchor: "12:abc", new_text: "const enabled = true;" } }
  ]
})
```

### `replace_lines`
Use `replace_lines` when you are replacing a contiguous block.

```text
edit({
  path: "src/foo.ts",
  edits: [
    {
      replace_lines: {
        start_anchor: "20:def",
        end_anchor: "24:123",
        new_text: "if (!enabled) {\n  return;\n}"
      }
    }
  ]
})
```

### `insert_after`
Use `insert_after` when you are adding new lines after a known anchor.

```text
edit({
  path: "src/foo.ts",
  edits: [
    { insert_after: { anchor: "30:456", new_text: "console.log(enabled);\n" } }
  ]
})
```

### `replace`
Use `replace` only as the escape hatch when anchored variants are not practical.

```text
edit({
  path: "src/foo.ts",
  edits: [
    { replace: { old_text: "legacyName", new_text: "newName", all: true } }
  ]
})
```

### `replace_symbol`
Use `replace_symbol` to replace an entire symbol's declaration range (function/method/class/etc.) by name. Resolution uses the same symbol-query syntax as `read symbol:` — supports `Foo.bar` dotted paths and `Foo.bar@<line>` disambiguation — but mutating replacements are limited to precise in-memory mappers currently registered for TypeScript, JavaScript, Rust, and Java.

```text
edit({
  path: "src/foo.ts",
  edits: [
    { replace_symbol: { symbol: "add", new_body: "export function add(a: number, b: number) {\n  return a + b + 1;\n}" } }
  ]
})
```

Rules and behavior:
- `symbol` is required and must resolve to exactly one symbol. Ambiguous or not-found queries return the same banner shape produced by `read symbol:` (use `Foo.bar@<startLine>` to disambiguate).
- `new_body` must not be empty or whitespace-only — empty bodies are rejected with `invalid-edit-variant`.
- The new body is dedented and re-indented to match the original symbol's leading indentation. Pass a flush body (no extra leading indent) and the tool will indent it correctly inside classes/namespaces.
- If `new_body` declares a different leaf name than the resolved symbol, a `name-mismatch: expected <old>, got <new>` warning is emitted (the edit still applies).
- Anchored edits (`set_line` / `replace_lines` / `insert_after`) in the same call may not target lines inside a `replace_symbol` range — that combination is rejected with `invalid-edit-variant`.
- `replace_symbol` honors the read-gate: the file must have been anchored earlier in the session (otherwise `file-not-read`).
- The post-write syntax-regression validator runs against the resulting content (see below).
- For languages supported by `read symbol:` but not by a precise in-memory mapper (for example Python/Go/Swift), use anchored edits instead of `replace_symbol`.

## Recovery from hash mismatch errors
When the file changes after you captured anchors, `edit` reports a hash mismatch and shows current file lines with `>>>` markers.

Example:

```text
3 lines have changed since last read. Auto-relocation checks only within ±20 lines.

    40:a12|function foo() {
>>> 41:b34|  const renamed = 3;
    42:c56|  return renamed;
```

Recovery steps:
1. Copy the updated `LINE:HASH` from the `>>>` line and retry the edit.
2. If the relevant content moved farther away, run `read` again.
3. If the error suggests nearby anchors, use the suggested anchor.
4. If a `replace_lines` edit partially relocates, re-read and recompute both anchors.

## Auto-relocation
If an anchor hash still matches uniquely within the relocation window, `edit` can auto-relocate the change and continue. Treat that as a warning to double-check the landing point.

## Common failure modes

### No changes made
If `edit` says the file did not change, your replacement may already match the current file contents.

### Whitespace-only change
If the result is classified as whitespace-only, verify that you changed the intended content and not just formatting.

### Missing anchor source
If `edit` says the file needs fresh anchors, obtain them with `read`, `grep`, `ast_search`, or `write` first.

### Invalid edit shape
Each edit entry must contain exactly one variant. Do not mix `set_line`, `replace_lines`, `insert_after`, `replace_symbol`, and `replace` in the same entry.

## Anchor sources
Any tool that emits `LINE:HASH|content` anchors can feed `edit`:
- `read`
- `grep`
- `ast_search`
- `write`

## Worked examples

### Search, then edit with `grep`
```text
grep({ pattern: "addRoute", path: "src", literal: true })
edit({ path: "src/server.ts", edits: [{ set_line: { anchor: "45:e4f", new_text: "router.addRoute('/api', nextHandler);" } }] })
```

### Structure search, then edit with `ast_search`
```text
ast_search({ pattern: "const $NAME = $_", lang: "typescript", path: "src" })
edit({ path: "src/foo.ts", edits: [{ set_line: { anchor: "18:9ac", new_text: "const value = compute();" } }] })
```

### Create, then refine with `write`
```text
write({ path: "src/new-file.ts", content: "export const value = 1;\n" })
edit({ path: "src/new-file.ts", edits: [{ set_line: { anchor: "1:2f9", new_text: "export const value = 2;" } }] })
```

## Notes
- Always copy anchors exactly as shown.
- Prefer anchored variants over `replace`.
- Re-run `read`, `grep`, `ast_search`, or `write` whenever you need fresh anchors.
- Anchored edits are validated and applied atomically from bottom to top.
- If a non-whitespace-intent edit produces only whitespace-only changes, the tool emits a prominent warning so you can re-read and verify before assuming behavior changed.
- After a successful replace-only batch, the tool emits an informational hint nudging you back toward anchored variants for safer future edits.

## Syntax-regression notice

After every successful write, `edit` runs a tree-sitter syntax-regression validator that compares parser ERROR/MISSING node counts before and after the edit. Languages currently covered: **Rust, C, C++, C headers, Java, Clojure**. Other languages and unmappable files are skipped (no warning, no block).

Modes:
- `warn` (default) — on a net-new ERROR or MISSING node, the edit still applies and a `syntax-regression: lines X-Y` entry is appended to the response `warnings` array.
- `block` — the edit is aborted with the `syntax-regression` ptc error code; the file on disk is unchanged.
- `off` — the validator is skipped entirely.

Mode resolution order: explicit `syntaxValidate` option > `PI_HASHLINE_SYNTAX_VALIDATE` env var > default `warn`. Invalid env values fall back to `warn`.

Pre-existing syntax errors do not trigger the warning (±1 tolerance on net-new ERROR count; MISSING is no-tolerance). The validator runs on LF-normalized content, so CRLF round-trips do not produce spurious regressions. The same validator runs for both anchored variants and `replace_symbol`.

## Error-precedence order for mixed edit batches

When an `edits[]` array mixes `replace_symbol` entries with anchored variants (`set_line` / `replace_lines` / `insert_after`), errors are surfaced in this priority order:

1. **`replace_symbol` symbol-resolution errors** (not-found, ambiguous) — returned immediately from the probe pass, before any overlap or anchor check runs and before any write occurs. Error code: `invalid-edit-variant`. Message: same format produced by `read symbol:"..."`.
2. **Anchor-overlap errors** — returned when an anchored edit's line falls inside a `replace_symbol` pre-replace range. Error code: `invalid-edit-variant`.
3. **Anchored-edit errors** — hash-mismatch or other anchor failures.

The probe pass runs all `replace_symbol` entries against the original file content first. If every probe succeeds, each resolved result is shared with the apply pass — replacements are applied from bottom to top using the probe's original line ranges and no `replace_symbol` entry invokes a second parse. This means `generateMapFromContent` is invoked at most once per `replace_symbol` entry across the probe+apply lifecycle.
