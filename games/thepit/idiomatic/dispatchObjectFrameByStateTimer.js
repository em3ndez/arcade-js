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
 * NAMES:    TRANSITION_TIMER (ram.js). The post-timer mode selector 0x807d has no ram.js name yet, so it
 *           stays a locally-named hex constant.
 *
 * PURPOSE [guess]: POST_TIMER_MODE (0x807d) unnamed; what each expiry gates.
 */

import { TRANSITION_TIMER } from "./ram.js";
import { advanceTrackedObject } from "./advanceTrackedObject.js";
import { dockManAndDispatchRoundBoundary } from "./dockManAndDispatchRoundBoundary.js";
import { advanceToNextLevel } from "./advanceToNextLevel.js";

// Selects the round-boundary routine when the countdown expires: 0 -> the round/state-boundary
// dispatcher, anything else -> the next-level advance. No ram.js name yet.
const POST_TIMER_MODE = 0x807d;

export function dispatchObjectFrameByStateTimer(m) {
  const { mem8 } = m;

  // Countdown idle: the object is free this frame — run the object/state dispatcher.
  if (mem8[TRANSITION_TIMER] === 0) return advanceTrackedObject(m);

  // Countdown running: tick it down and hold the object locked while it is still running.
  const remaining = mem8[TRANSITION_TIMER] - 1;
  mem8[TRANSITION_TIMER] = remaining;
  if (remaining !== 0) return; // still locked -> nothing else this frame

  // Countdown just reached zero: the timed state is over. Hand to the round-boundary routine the
  // post-timer mode selector picks.
  if (mem8[POST_TIMER_MODE] === 0) return dockManAndDispatchRoundBoundary(m);
  return advanceToNextLevel(m);
}
