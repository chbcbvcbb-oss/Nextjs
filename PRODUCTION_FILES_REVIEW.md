# Production Source File Review

Systematic review of production source files under `packages/next/src/`
(~1404 files, tests excluded). For each file: understand what it does,
check edge cases in input handling, and note the filename if something is
broken.

## Files with issues found

- `packages/next/src/export/helpers/get-params.ts`
  — The `last` memoization cache is declared but never assigned, so
  `last?.page === page` can never be true; the route-matcher cache is dead
  code and every call recompiles the regex (perf bug, not correctness).

- `packages/next/src/telemetry/storage.ts`
  — In `record()`, `(prom as any)._controller = (prom as any)._controller`
  is a self-assignment no-op. The `AbortController` created in
  `submitRecord()` is attached to a different promise object and never
  reaches the queued promise, so `flushDetached()`'s
  `item._controller?.abort()` never aborts anything. In-flight events can
  be submitted twice (once by the live fetch, once by the detached flush).

- `packages/next/src/export/worker.ts`
  — In `exportPage()`, the first span `trace('export-page', ...)` gets an
  attribute but is never stopped, so it is never reported (dead span).
  Also each page export's timeout `setTimeout` from the `Promise.race` in
  `exportPageWithRetry()` is never cleared after the export finishes,
  leaving a dangling timer per page (up to `staticPageGenerationTimeout`
  seconds each).

- `packages/next/src/lib/download-swc.ts`
  — Two bugs: (1) the cache-prune loop is
  `for (let i = 0; i++; i < cacheFiles.length - MAX_VERSIONS_TO_CACHE)` —
  the condition and increment clauses are swapped, so the condition `i++`
  evaluates to 0 (falsy) on first check and the prune loop never executes;
  the swc binary cache grows without bound. (2) In `downloadNativeNextSwc`,
  `if (fs.existsSync(outputDirectory)) return` inside the `for (const
  triple of triplesABI)` loop should be `continue`; if the first triple is
  already downloaded, all remaining triples are silently skipped.

## Minor / informational (not counted as broken)

- `packages/next/src/telemetry/detached-flush.ts` — the advertised "old
  format" (no eventsFile arg) can never work: with only 2 args, `mode`
  ends up as the script path and validation throws. Unreachable in
  practice since the only caller (`storage.ts` `flushDetached`) always
  passes 3 args.
- `packages/next/src/trace/report/to-json-build.ts` — duplicates the
  entire `RotatingWriteStream` class from `to-json.ts`, including a dead
  dev-phase size-limit branch (this file only runs in production builds).
- `packages/next/src/lib/get-files-in-dir.ts` — a broken symlink in the
  scanned directory makes `fs.stat` throw ENOENT and the whole listing
  fails instead of skipping the entry.
- `packages/next/src/lib/helpers/get-cache-directory.ts` — on an
  unsupported platform with no usable cache dir it calls
  `process.exit(0)` (success exit code) after logging an error.
- `packages/next/src/lib/typescript/runTypeCheck.ts` — always returns
  `hasWarnings: true` even when the warnings array is empty.
- `packages/next/src/lib/memory/trace.ts` — heap snapshot filename uses
  `description.replace(' ', '-')` which only replaces the first space
  (filenames keep remaining spaces); `distDir` from traceGlobals may be
  undefined at call time, which would throw in `join()`.

## Coverage log (directories completed)

- [x] `packages/next/src/cli/` (11 files)
- [x] `packages/next/src/export/` (12 files)
- [x] `packages/next/src/trace/` (10 files)
- [x] `packages/next/src/telemetry/` (16 files)
- [ ] `packages/next/src/lib/` (51 files) — next up
- [ ] `packages/next/src/experimental/` (22 files)
- [ ] `packages/next/src/client/` (119 files)
- [ ] `packages/next/src/shared/` (138 files)
- [ ] `packages/next/src/server/` (388 files)
- [ ] `packages/next/src/build/` (213 files)
- [ ] `packages/next/src/next-devtools/` (174 files)
- [ ] `packages/next/src/compiled/` (20 files, vendored — low priority)
- [ ] misc: `experimental/`, `bundles/`, remaining single files
