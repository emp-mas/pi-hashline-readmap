# Megapowers Session Changelog

## Issue #001: Project Scaffold — CLOSED ✅
**Date**: 2026-02-26

### Delivered
- Full TypeScript pi extension scaffold (`pi-hashline-readmap`) unifying source from:
  - `pi-hashline-edit@0.3.0` (hashline read/edit/grep)
  - `pi-read-map@1.3.0` (structural file maps)
  - `pi-rtk@0.1.3` (bash output techniques)
- 33 passing Vitest tests across 8 test files
- `tsc --noEmit` exits 0, `npm test` exits 0
- All 17 acceptance criteria verified

### Side effects on later issues
- **#002 (import hashline-edit)**: Fully completed by #001 scaffold — close as duplicate
- **#003 (import readmap mapper)**: Fully completed by #001 scaffold — close as duplicate
- **#011 (import RTK techniques)**: Fully completed by #001 scaffold — close as duplicate
- **M4 tasks**: RTK source files are already in `src/rtk/`, only wiring (#012) and tests (#013) remain

### Learnings captured
7 learnings saved to `.megapowers/plans/001-project-scaffold/learnings.md`

## Issue #014 (Batch): M1 Core Integration — Map into Read Tool — CLOSED ✅
**Date**: 2026-02-26
**Source Issues**: #004 (integrate map into read tool), #005 (update read prompt), #006 (unit and integration tests)

### Delivered
- `src/map-cache.ts`: mtime-keyed in-memory cache (`getOrGenerateMap`, `clearMapCache`) — AC-1.1–AC-1.7
- `src/read.ts`: truncated reads (no offset/limit) now append `formatFileMapWithBudget()` structural map section; all map errors silently swallowed — AC-2.1–AC-2.7
- `index.ts`: wired `registerReadTool`, `registerEditTool`, `registerGrepTool` in default export — AC-3.1–AC-3.3
- `prompts/read.md`: updated to document map output, 17-language support, mtime caching, targeted-read usage — AC-4.1–AC-4.5
- Test fixtures: `tests/fixtures/small.ts`, `large.ts`, `small.py`, `sample.bin`, `plain.txt` — AC-5.1–AC-5.5
- 60 tests across 12 test files, all passing; `tsc --noEmit` exits 0

### Changelog (for CHANGELOG.md)
```
## [Unreleased]
### Added
- `read` tool accepts optional `map: true` parameter to append structural map for any file, even small ones; mutually exclusive with `symbol` (#039)
- `grep` tool accepts optional `summary: true` parameter returning `[N matches in M files]` header + per-file counts sorted descending, no hashline anchors (#039)
- `grep` tool appends `[Results truncated at N matches — refine pattern or increase limit]` when results hit the limit in both normal and summary modes (#039)
- `prompts/sg.md` expanded with 7 additional pattern examples (class, if, try-catch, arrow functions, JSX, async) and a 7-entry Tips & Common Pitfalls section (#039)
- `prompts/read.md` symbol table expanded with 4 new symbol type examples: interface, type alias, const/variable, enum (#039)
- Map cache module (`src/map-cache.ts`) with mtime-keyed cache for FileMap results (#004)
- Structural map appended to truncated reads in `src/read.ts`; map failures are silent (#004)
- All three tools (read, edit, grep) wired in `index.ts` default export (#004)
- Updated `prompts/read.md` to document map output, 17 languages, mtime caching (#005)
- Test fixtures (small.ts, large.ts, small.py, sample.bin, plain.txt) and 27 new tests (#006)
```
✅ All three wrap-up actions complete:

1. **write-changelog** — Appended entry to `.megapowers/CHANGELOG.md` documenting all deliverables from issues #004, #005, #006 (source `CHANGELOG.md` is write-protected in done phase, so the entry is staged in `.megapowers/CHANGELOG.md` ready to be applied when write access is restored).

2. **capture-learnings** — 7 bullet-point learnings saved to `.megapowers/plans/014-m1-core-integration-map-into-read-tool-p/learnings.md` covering: silent-catch discipline, mtime cache simplicity, real-file tests over mocks, fixture sizing, parallel task ordering, formatter edge-case handling, and arity smoke tests.

3. **close-issue** — Issue #014 and all three source issues (#004, #005, #006) marked `status: closed` in `.megapowers/issues/`. (The phase is already at terminal `done` — no further phase transitions are available.)
Done — I executed all selected wrap-up actions in order.

### ✅ Completed Actions

1. **write-changelog**
   - Updated `CHANGELOG.md` under `## [Unreleased]` → `### Added`:
   - `- Added symbol-addressable reads via read(path, { symbol }) ... (#015)`

2. **capture-learnings**
   - Saved learnings artifact via:
   - `megapowers_save_artifact({ phase: "learnings", ... })`
   - File saved by system at:
   - `.megapowers/plans/015-m2-symbol-addressable-read-lookup-engine/learnings.md`

3. **squash-task-changes**
   - Ran squash successfully after retrying with safe flags:
   - `jj --ignore-working-copy squash --into @- --use-destination-message`

4. **close-issue**
   - All wrap-up actions are now complete.

---

Issue **015-m2-symbol-addressable-read-lookup-engine** is ready to close.  
You can run **`/issue close`** now, or select a new issue to continue.
---

All four selected wrap-up actions completed:

1. ✅ **write-changelog** — Entry written to `.megapowers/plans/010-ast-grep-tool-wrapper/changelog-entry.md` (source writes are blocked in done phase; apply it to `CHANGELOG.md` manually or in a follow-up)
2. ✅ **capture-learnings** — 7 bullets saved to `.megapowers/plans/010-ast-grep-tool-wrapper/learnings.md`
3. ✅ **squash-task-changes** — `jj squash --into @-` completed cleanly
4. ✅ **close-issue** — All actions done

**Issue #010 is ready to close.** To close it, run `/issue close` or select a new issue to continue.

---

To directly answer your original question: **`generate-docs`** (which would write `docs/features/010-ast-grep-tool-wrapper.md`) was not in the selected wrap-up actions for this issue, so it was skipped. If you want the feature doc written, just say the word.
All four wrap-up actions complete. Here's what was done:

---

### ✅ Completed Wrap-up Actions

1. **`write-changelog`** — Appended entry to `CHANGELOG.md` describing the bash output compression filter feature (#016).

2. **`capture-learnings`** — Wrote 7 bullet-point learnings to `.megapowers/plans/016-m4-bash-output-compression-filter-routin/learnings.md` covering routing design, null-fallthrough pattern, test coverage gaps, and integration testing tradeoffs.

3. **`squash-task-changes`** — Ran `jj squash --into @-` successfully. All per-task changes are now consolidated into the phase commit.

4. **`close-issue`** — Issue #016-m4-bash-output-compression-filter-routin is ready to close (which also covers source issues #012 and #013).

---

The issue is complete. You can now run `/issue close` to mark it done, or pick up the next issue.
All three wrap-up actions complete:

### ✅ write-changelog
Changelog entry generated (above) — system will append to `.megapowers/CHANGELOG.md`.

### ✅ capture-learnings
Saved to `.megapowers/plans/022-exploratory-testing-bug-fixes/learnings.md` — 7 bullets covering:
- Binary detection must precede `Buffer.toString()`
- `Array.join("")` false-positive noop pattern and the length-guard fix
- `splitDst()` as the highest-risk internal helper (CRLF normalization)
- Exit code semantics need documentation at the call site
- `tsc --noEmit` catches what vitest misses (incomplete fixtures)
- `@LINE` vs `#index` ergonomics for symbol disambiguation
- "FAILS:" test title convention debt

### ✅ close-issue
**Issue #022 is ready to close.** Run `/issue close` to finalize, or select a new issue to continue.
## Action 3: close-issue

All wrap-up actions completed:

| Action | Status |
|--------|--------|
| **write-changelog** | ✅ Done — changelog entry generated (5 entries: 3 Fixed, 2 Added) |
| **capture-learnings** | ✅ Done — 7 learnings saved to `.megapowers/plans/037-wave-2-edit-pipeline-bugs-resilience/learnings.md` |
| **close-issue** | ✅ Reporting now |

---

**Issue 037 (`wave-2-edit-pipeline-bugs-resilience`) is complete and ready to close.**

### Summary of what shipped

- **#023** — `edit` write-path now catches `EACCES`/`EPERM` and returns `"Permission denied: <path>"` (was: unhandled Node error)
- **#024** — `read` prepends a bare-CR warning header when `\r`-only line endings are detected (was: silent mismatch with ripgrep)
- **#030a** — `edit` reads as Buffer first and rejects NUL-byte files with `"Cannot edit binary file: <path>"` (was: silent corruption)
- **#030b** — Anchor mismatch errors include `"Did you mean?"` similarity suggestions in `LINE:HASH|content` format when anchor carries content (was: no guidance)
- **#030c** — `compactDiff` preserves all `+`/`-` lines, compresses context to 3/side, default cap 100, configurable, with `... +K more changes` truncation indicator (was: hard-capped at 10 hunk lines / 50 total)

**218 tests pass, 0 failures.**

Run `/issue close` to close this issue, or select a new issue to continue.
PR created: https://github.com/coctostan/pi-hashline-readmap/pull/8

### Action 4: close-issue

Historical wrap-up note from the original #039 work session:

---

## Partial wrap-up note — Issue #039

The original implementation session shipped these completed pieces of #039:
- `read` tool: `map: true` parameter appends structural map for any file on demand
- `grep` tool: `summary: true` parameter for per-file match counts; truncation indicator at result limit
- `prompts/sg.md`: expanded examples + Tips & Common Pitfalls section
- `prompts/read.md`: expanded symbol examples

Post-audit correction (2026-03-16): issue #039 was **not fully completed**. The following scope remains open in `.megapowers/issues/039-read-grep-sg-agent-ux-enhancements.md`:
- multi-file read support
- directory listing mode for `read`

The original PR/branch history is still valid historical context, but #039 should remain open until those remaining read-tool UX items are implemented.

## Issue #052: Escape control characters in hashlined tool output — CLOSED ✅
**Date**: 2026-03-16
### Fixed
- Escaped raw ASCII control characters in `read`, `grep`, and `sg` hashlined output so copied tool output no longer breaks downstream JSON tool calls (#052)
- Preserved anchor stability by keeping hash computation on raw line text and applying escaping only in display formatting (#052)
- Escaped related control-character previews in hashline mismatch diagnostics and edit no-op diagnostics (#052)
### Tests
- Added regression coverage for `read`/`grep`, `sg`, `hashLines()`, `hashLine()`, mismatch diagnostics, and edit diagnostics
- Verified with `npm test` → 71 passing files / 388 passing tests