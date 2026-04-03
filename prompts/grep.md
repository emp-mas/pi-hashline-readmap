Search file contents for a pattern. Returns matching lines with `LINE:HASH` anchors for hashline edit workflows.

## Search Modes

### Default mode
Returns matching lines prefixed with `LINE:HASH|content` anchors. Use `>>` markers to identify match lines vs context lines.

### Context mode (`context: N`)
Includes N surrounding lines before and after each match. Nearby matches are merged and deduplicated automatically. Use when you need to see the code around a match, not just the matching line.

### Summary mode (`summary: true`)
Returns per-file match counts only — no line content, no anchors. Use this first to scope a broad search across many files, then drill into specific files with a targeted search.

### Symbol-scoped mode (`scope: "symbol"`)
Groups matches by their enclosing function, method, or class. Shows the full symbol block containing each match, not just the matching line. Falls back gracefully for files without structural maps. Ignored when `summary: true`.

## Parameters

- `pattern` — Search pattern (regex by default, or literal string with `literal: true`)
- `path` — Directory or file to search (default: current directory)
- `glob` — Filter files by glob pattern, e.g. `'*.ts'` or `'**/*.test.ts'`
- `ignoreCase` — Case-insensitive search (default: false)
- `literal` — Treat pattern as literal string instead of regex (default: false). Use for exact matches to avoid regex escaping issues.
- `context` — Number of lines to show before and after each match (default: 0)
- `limit` — Maximum number of matches to return (default: 100)
- `summary` — Return per-file match counts only (no hashline anchors)
- `scope` — Set to `"symbol"` to group matches by enclosing symbol block

## Usage Guidance

- Use `summary: true` first to scope a broad search, then drill into specific files with `path` or `glob`
- Use `scope: "symbol"` when you need to understand the context of matches, not just find them
- Use `literal: true` for exact string matches (e.g., searching for `$variable` or `array[0]`) to avoid regex escaping issues
- Anchors from grep can be used directly in `edit` — no intermediate `read` needed
- For structural code patterns (function calls, imports, JSX), prefer `ast_search` if available

## Workflow: grep → edit

1. Search: `grep({ pattern: "oldFunction", glob: "*.ts" })`
2. Review output — each match has a `LINE:HASH` anchor
3. Use anchors directly: `edit({ path: "file.ts", edits: [{ set_line: { anchor: "45:a3f", new_text: "newFunction();" } }] })`

## Output Format

```
[3 matches in 2 files]
--- src/server.ts (2 matches) ---
src/server.ts:>>45:a3f|router.addRoute("/api", handler);
src/server.ts:  46:b12|router.addRoute("/health", healthCheck);
--- src/client.ts (1 match) ---
src/client.ts:>>12:c7e|const api = new ApiClient();
```

Lines with `>>` are matches; lines with `  ` (two spaces) are context lines.
