/**
 * A one-shot callback that fires after a delay unless it's cancelled or flushed
 * first.
 *
 * Turbopack reports a compile pass (a BUILDING/BUILT pair) for *every*
 * foreground-job cycle, including empty no-op recompiles that changed nothing
 * (e.g. scheduled by request/render activity). Both the dev server (deciding
 * whether to send the BUILDING HMR message) and the browser client (deciding
 * whether to log `[Fast Refresh] rebuilding`) want the same behavior: defer the
 * "compiling started" signal briefly, then
 *
 *   - `flush()` it immediately once real work shows up (so it still precedes
 *     the update it belongs to), or
 *   - `cancel()` it if the pass ends first with nothing to show (suppressing
 *     the spurious signal entirely).
 *
 * `schedule()` replaces any still-pending emit, so re-arming on a new pass is
 * safe.
 */
export class DeferredEmit {
  #timer: ReturnType<typeof setTimeout> | undefined
  #fn: (() => void) | undefined

  /** Arm `fn` to run after `delayMs`, replacing any still-pending emit. */
  schedule(delayMs: number, fn: () => void): void {
    this.cancel()
    this.#fn = fn
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      const fnToRun = this.#fn
      this.#fn = undefined
      fnToRun?.()
    }, delayMs)
  }

  /** If an emit is pending, run it now instead of waiting for the delay. */
  flush(): void {
    if (this.#timer === undefined) {
      return
    }
    clearTimeout(this.#timer)
    this.#timer = undefined
    const fnToRun = this.#fn
    this.#fn = undefined
    fnToRun?.()
  }

  /** Cancel a pending emit without running it. */
  cancel(): void {
    if (this.#timer === undefined) {
      return
    }
    clearTimeout(this.#timer)
    this.#timer = undefined
    this.#fn = undefined
  }

  get isPending(): boolean {
    return this.#timer !== undefined
  }
}
