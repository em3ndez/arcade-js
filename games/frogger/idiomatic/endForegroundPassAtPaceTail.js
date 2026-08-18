// SPDX-License-Identifier: GPL-3.0-only
/**
 * endForegroundPassAtPaceTail  —  ROM 0x0368  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The "pace tail" re-entry point of the foreground main loop, modelled as a coroutine. In the ROM the
 *   foreground loop body has two entry points: the HEAD `MAIN_LOOP_HEAD` (0x0341) — run once per attract
 *   pass to draw the score/credit header and scan the start buttons — and the PACE TAIL `PACE_TAIL`
 *   (0x0368). Once the in-play dispatcher has produced a frame's foreground, the ROM re-enters here with a
 *   bare `jp 0x0368`, deliberately SKIPPING the head, because the in-play path has already done the head's
 *   render work itself. In the original machine 0x0368 is the mouth of a busy-delay: the CPU spins there
 *   writing no state until the vblank interrupt preempts it and fires the NMI. That spin is pure pacing —
 *   it exists only to burn cycles until the next frame — not computation.
 *
 * WHERE IT SITS
 *   Every branch of the translated in-play tree tail-calls this in place of executing `jp 0x0368`:
 *   setUpBoardOrContinueLife (the per-frame board/life dispatcher), coldStartClearPlayRamAndSetMode,
 *   beginNextLifeOrIntro, runIntroTimerThenInitGame, and setUpPlayerTwoContinue each end with
 *   `return endForegroundPassAtPaceTail(m)`. The genuine per-frame pacing — deciding WHEN a pass is
 *   finished and the NMI should fire — belongs instead to the vblank coroutine
 *   drainForegroundThenYieldEachVblank (0x0341), which owns the `yield`. This routine's whole job is to
 *   represent the fact "we reached the pace tail" and hand control back up to that driver.
 *
 * WHY IT IS EMPTY
 *   It is a GENERATOR FUNCTION with an empty body. Calling `endForegroundPassAtPaceTail(m)` CONSTRUCTS a
 *   generator object without running any of it — a generator's body executes only on the first `.next()` —
 *   the same way a Z80 `jp` transfers control while touching nothing. The callers return that unrun object
 *   up the tail-call chain to runOneForegroundPass, which discards it and never advances it, so the body
 *   never runs and no busy-delay spin is reproduced. The driver — not a delay loop inside the ROM — then
 *   decides the pass is complete and yields, letting the engine fire the NMI at exactly the right frame
 *   boundary. The `m` machine argument the callers pass is intentionally ignored: there is no work to do
 *   with it here, which is why the parameter list is left empty.
 *
 * LIVE-OUT
 *   None. It reads no cell, writes no RAM, and hands back only an inert, never-advanced generator object
 *   that the driver throws away. Reaching the pace tail is the entire effect.
 */
export function* endForegroundPassAtPaceTail() {
  // Empty by design — see "WHY IT IS EMPTY" above. The ROM's pace-tail busy-delay loop at 0x0368 wrote
  // no state, so there is nothing to translate. Control simply returns (as an unrun generator) to the
  // vblank coroutine drainForegroundThenYieldEachVblank (0x0341), which owns the per-frame `yield`.
}
