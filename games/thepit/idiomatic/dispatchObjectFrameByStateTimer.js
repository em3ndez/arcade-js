// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchObjectFrameByStateTimer — per-frame head of the object/state dispatcher, gated by the state-lockout timer.  ROM 0x13c9.
 *
 * Runs first thing each frame for the tracked object. A state-lockout countdown can hold the
 * object frozen in a timed state; this gate decides, from that countdown, what the frame does:
 *
 *   - Countdown idle (zero): the object is free — advance it through the per-frame object/state
 *     dispatcher (advanceTrackedObject).
 *   - Countdown running: tick it down by one and, while it is still running, do nothing else this
 *     frame — the object stays locked until the timer drains.
 *   - Countdown reaches zero this frame: the timed state is over, so hand to a round-boundary
 *     routine chosen by the post-timer mode selector — mode zero routes to the round/state-boundary
 *     dispatcher (dockManAndDispatchRoundBoundary); any other value routes to the next-level advance (advanceToNextLevel).
 *
 * The chosen handler is the object's whole remaining work this frame; handing off is this routine's
 * own return. It writes no memory of its own beyond the countdown decrement.
 *
 * Memory-equivalent to the frozen oracle — equivalence-13c9.test.js.
 * GATE:     crafted-entry + real reachability. Attract reaches the dispatch arm (3451×), the tick
 *           arm (243×) and the mode-0 expiry arm (1×); the mode-nonzero expiry arm is crafted.
 *           RAM-only diff (dumpState) excluding the dead top-of-stack scratch — the handler chains
 *           thread bytes through the stack (real diffed work RAM near 0x83fd) that the stack-free
 *           idiomatic calls do not reproduce; no real output lives at 0x83xx (real cells are
 *           ≤0x813x, sprite records 0x8220+, video 0x9000+), and the teeth prove it. Both expiry
 *           arms run their real boundary chain (frame-tick + stubbed true leaves 0x031a / 0x01f9)
 *           from a live-game crafted entry, where the two handlers genuinely diverge. Teeth: a twin
 *           that skips the countdown decrement, one that drops the object dispatch, and one that
 *           swaps the two expiry destinations.
 * LIVE-OUT: memory-only — the decremented countdown (TRANSITION_TIMER) plus whatever the chosen handler
 *           writes. No caller reads a register or flag back; every exit is a tail hand-off or a bare
 *           stop.
 * NAMES:    TRANSITION_TIMER, POST_TRANSITION_MODE (names.js).
 *
 * PURPOSE [guess]: POST_TRANSITION_MODE — what each expiry gates.
 */

import { TRANSITION_TIMER, POST_TRANSITION_MODE } from "./names.js";
import { advanceTrackedObject } from "./advanceTrackedObject.js";
import { dockManAndDispatchRoundBoundary } from "./dockManAndDispatchRoundBoundary.js";
import { advanceToNextLevel } from "./advanceToNextLevel.js";

export function dispatchObjectFrameByStateTimer(m) {
  const { mem8 } = m;

  // Countdown idle: the object is free this frame — run the object/state dispatcher.
  if (mem8[TRANSITION_TIMER] === 0) return advanceTrackedObject(m);

  // Countdown running: tick it down and hold the object locked while it is still running.
  const remaining = mem8[TRANSITION_TIMER] - 1;
  mem8[TRANSITION_TIMER] = remaining;
  if (remaining !== 0) return; // still locked -> nothing else this frame

  // Countdown just reached zero: the timed state is over. The frozen oracle tail-jumps from here
  // into a fresh, never-returning main loop; in the coroutine model that is a mid-frame warm
  // restart — abandon this frame and swap the whole main generator (m.restartMain throws RESTART,
  // caught by runGeneratorGame). The post-timer mode selector picks which boundary loop runs.
  if (mem8[POST_TRANSITION_MODE] === 0) return m.restartMain(() => dockManAndDispatchRoundBoundary(m));
  return m.restartMain(() => advanceToNextLevel(m));
}
