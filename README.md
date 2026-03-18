# pi-hashline-readmap

A drop-in [pi](https://github.com/mariozechner/pi-coding-agent) extension that replaces the stock `read`, `edit`, `grep`, and `sg` workflows with a single, integrated toolset built for reliable agent coding.

It combines:
- **hash-anchored read/edit/grep**
- **structural file maps**
- **symbol-addressable reads**
- **AST-grep with hashline output**
- **bash output compression**

## Why use this instead of the stock tools?

The stock tools work, but they leave a lot of efficiency and reliability on the table.

### 1. Safer edits
Stock read/search output is easy for a model to paraphrase or drift from.

This package returns **`LINE:HASH|content` anchors** so the follow-up edit can target the exact line that was read:

```text
45:e4|router.addRoute("/api", handler);
```

That means:
- fewer accidental edits to the wrong line
- better resistance to file drift between read and edit
- much more reliable surgical changes

### 2. Better navigation on large files
Stock file reads are just text.

This package can append a **structural map** for large files so the agent sees classes, functions, methods, and ranges instead of scrolling blind through thousands of lines.

### 3. Direct symbol lookup
Instead of hunting with offsets, the agent can ask for:

```ts
read({ path: "src/server.ts", symbol: "handleRequest" })
read({ path: "src/router.ts", symbol: "Router.addRoute" })
```

That cuts tokens and reduces exploratory round-trips.

### 4. Search results that are immediately editable
`grep` and `sg` output is formatted so the agent can go straight from:
- search
- to anchored result
- to `edit`

without needing a cleanup read in between.

### 5. Less wasted context on noisy command output
Large `bash` outputs from test runners, builds, git, and linters are compressed into the parts that matter.

That means more context budget goes to code, not terminal noise.

### 6. One package, no overlapping-tool fights
A common pi problem is stacking multiple extensions that all want to own `read`, `grep`, or `edit`.

This package is useful specifically because it **unifies the overlapping improvements into one extension** instead of forcing you to choose between them.

## What you get

### `read`
- `LINE:HASH|content` output
- optional structural maps via `map: true`
- structural maps support **17 languages** including TypeScript, Python, Rust, Go, C/C++, Java, SQL, YAML, TOML, and Markdown
- automatic maps on truncated reads
- symbol lookup via `symbol`
- image delegation
- display-safe escaping for control characters in output

### `edit`
- hash-verified anchored edits
- `set_line`, `replace_lines`, `insert_after`, and `replace`
- compact diff / full diff support
- better mismatch diagnostics

### `grep`
- hash-anchored match output
- context support with deduped/merged windows
- `summary: true` mode for file-level match counts
- truncation indicators when results hit the limit
- output ready to feed directly into `edit`

### `sg`
- wraps `ast-grep`
- returns merged, hash-anchored match blocks
- ideal for structural search → edit workflows

### `bash`
- test/build/git/linter-aware output compression
- ANSI stripping
- less token waste in long command output

## Example workflows

### Read → edit

```text
read({ path: "src/server.ts" })
```

```text
45:e4|router.addRoute("/api", handler);
```

```text
edit({
  path: "src/server.ts",
  edits: [
    {
      set_line: {
        anchor: "45:e4",
        new_text: 'router.addRoute("/api/v2", handler);'
      }
    }
  ]
})
```

### Symbol read

```text
read({ path: "src/server.ts", symbol: "handleRequest" })
```

Returns only that symbol’s body, already hashlined.

### Read with a map

```text
read({ path: "src/large-file.ts", map: true })
```

Returns scoped hashlines plus a structural outline of the file.

### Search → edit with grep

```text
grep({ pattern: "addRoute", path: "src", literal: true })
```

```text
[3 matches in 2 files]
--- src/server.ts (2 matches) ---
src/server.ts:>>45:e4|router.addRoute("/api", handler);
```

Use the anchor directly in `edit`.

### Structural search with sg

```text
sg({ pattern: "console.log($$$ARGS)", lang: "typescript", path: "src" })
```

Returns hash-anchored AST matches grouped by file.

## Installation

### From npm

```bash
pi install npm:pi-hashline-readmap
```

### From GitHub

```bash
pi install git:github.com/coctostan/pi-hashline-readmap
```

### From a local clone

```bash
git clone https://github.com/coctostan/pi-hashline-readmap.git
cd pi-hashline-readmap
npm install
pi install .
```

## Requirements

- Node.js **>= 20**
- pi with extension support

Optional but recommended for full functionality:

```bash
brew install ast-grep
brew install difftastic
brew install shellcheck yq scc
```

## Usage notes

### `read`

- `map` and `symbol` are mutually exclusive
- `symbol` cannot be combined with `offset` or `limit`
- large reads can automatically append structural maps
- symbol reads preserve hash anchors for later edits

### `grep`

- `summary: true` returns plain-text orientation output, not anchors
- normal grep output includes anchors and is edit-ready
- when results hit the limit, output includes a truncation hint

### `sg`

- requires `ast-grep` installed on your machine
- overlapping/adjacent match ranges are merged before output
- output is grouped by file and anchored for editing

### PTC structured output

`read`, `grep`, `sg`, and `edit` keep their current human-facing `content[].text` output, but also expose a machine-facing payload at `details.ptcValue`.

Current structured shapes:

- `read.details.ptcValue`
  - `tool: "read"`
  - `path: string`
  - `range: { startLine, endLine, totalLines }`
  - `warnings: Array<{ code, message }>`
  - `truncation: null | { outputLines, totalLines, outputBytes, totalBytes }`
  - `symbol: null | { query, name, kind, parentName, startLine, endLine }`
  - `map: { requested, appended }`
  - `lines: Array<{ line, hash, anchor, raw, display }>`

- `grep.details.ptcValue`
  - `tool: "grep"`
  - `summary: boolean`
  - `totalMatches: number`
  - `records: Array<{ path, line, hash, anchor, kind, raw, display }>`

- `sg.details.ptcValue`
  - `tool: "sg"`
  - `files: Array<{ path, ranges: Array<{ startLine, endLine }>, lines: Array<{ line, hash, anchor, raw, display }> }>`

- `edit.details.ptcValue`
  - `tool: "edit"`
  - `ok: boolean`
  - `path: string`
  - `summary: string`
  - `diff: string`
  - `firstChangedLine?: number`
  - `warnings: string[]`
  - `noopEdits: Array<{ editIndex, loc, currentContent }>`

Hashes and anchors remain tied to raw file content semantics. `display` stays escaped for safe rendering, while `raw` preserves the underlying file text for programmatic consumers.

### PTC tool policy contract

In addition to `details.ptcValue`, the package exports a machine-readable policy contract at `HASHLINE_TOOL_PTC_POLICY` and `getHashlineToolPtcPolicy()`.

```ts
import { HASHLINE_TOOL_PTC_POLICY } from "pi-hashline-readmap";
```

Recommended exposure tiers:
- `read` and `grep` are safe-by-default, read-only helpers.
- `sg` is opt-in, read-only.
- `edit` is not safe-by-default and is mutating/write-capable.

`pi-prompt-assembler` may optionally consume this contract, but `pi-hashline-readmap` does not require `pi-prompt-assembler` to be installed in order to function.
## Why this is especially good for agents

This extension is optimized around the actual failure modes of coding agents:
- copying stale line content
- editing the wrong line after nearby changes
- wasting context on giant files
- wasting context on giant terminal output
- needing multiple tools that conflict with each other
- breaking downstream tool-call JSON by echoing unsafe raw text

In short: it makes the common read/search/edit loop **more deterministic, more token-efficient, and more composable**.

## Development

```bash
npm install
npm test
npm run typecheck
```

Current repository layout:

```text
index.ts              # extension entry point
src/
  read.ts             # read tool
  edit.ts             # edit tool
  grep.ts             # grep tool
  sg.ts               # ast-grep wrapper
  hashline.ts         # anchor generation / validation
  map-cache.ts        # structural map cache
  readmap/            # structural map engine
  rtk/                # bash output compression
prompts/              # tool prompt files
tests/                # vitest suite
```

## Publishing

```bash
npm pack --dry-run
npm publish
```

The published package includes:
- `index.ts`
- `src/`
- `prompts/`
- `LICENSE`
- `README.md`

## Credits

This project combines and adapts ideas/code from:
- [pi-hashline-edit](https://github.com/nicholasgasior/pi-hashline-edit)
- [pi-read-map](https://github.com/nicholasgasior/pi-read-map)
- [pi-rtk](https://github.com/mcowger/pi-rtk)

## License

MIT — see [LICENSE](LICENSE).
