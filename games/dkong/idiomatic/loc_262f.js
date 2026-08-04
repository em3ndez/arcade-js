// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_262f — per-frame driver for the second of three near-identical timed board objects:
 * pick an arm by how high Mario is on the screen, then run the shared publish/animate tail.
 *
 * Each frame this takes one of two paths, and both end in the same tail:
 *
 *   - Mario HIGH on the screen — his Y below the threshold, since smaller Y is higher —
 *     hands straight to the arm that forces this object's step-direction latch negative
 *     before the tail runs.
 *   - Mario at or below that threshold runs this object's own reverse timer:
 *       · on ODD frames the timer is skipped entirely and the tail runs as-is;
 *       · on EVEN frames the timer ticks down by one. On the single frame it reaches zero
 *         it is reloaded to its full period and the object's step-direction latch is
 *         REVERSED — +2 if it was negative, -2 otherwise — so the object periodically
 *         flips which way it travels.
 *
 * The shared tail reduces the latch to a ±1 unit step, publishes both polarities to the
 * mover's shadow bytes, and every 32nd frame advances this object's mirrored sprite pair.
 * So Mario's height forces the direction one way while the even-frame timer flips it back
 * and forth, and the tail is what delivers the resulting step to the object on screen.
 *
 * NOT CLAIMED: which on-screen object this steers. What is pinned is the mechanism — a
 * Mario-position-gated timer and periodic direction reversal — not the identity of the
 * thing being moved.
 *
 * Reads: Mario's Y; the frame counter; this object's reverse timer.
 * Writes: this object's reverse timer, and — through the reversal helper, on the frame the
 * timer expires — its step-direction latch.
 *
 * LIVE-OUT: memory-only. Every exit hands off to the shared tail, directly or through the
 * force-negative arm.
 */

import { MARIO_Y, FRAME, M50_OBJ2_REVERSE_TIMER, M50_OBJ2_STEP_DIR } from "./names.js";
import { loc_266f } from "./loc_266f.js";
import { reverseStepDirection } from "./reverseStepDirection.js";
import { loc_264c } from "./loc_264c.js";

export function loc_262f(m) {
  const { regs, mem } = m;

  // Mario high on the screen (smaller Y is higher): force this object's step-direction
  // negative, then run the shared tail.
  if (mem.read8(MARIO_Y) < 0xc0) {
    return loc_266f(m);
  }

  // At or below the threshold. Only run the reverse timer on EVEN frames; an odd frame
  // drops straight into the shared tail.
  if ((mem.read8(FRAME) & 0x01) !== 0) {
    return loc_264c(m);
  }

  // Even frame: tick the reverse timer down. Until it reaches zero, run the tail as-is.
  const next = (mem.read8(M50_OBJ2_REVERSE_TIMER) - 1) & 0xff;
  mem.write8(M50_OBJ2_REVERSE_TIMER, next);
  if (next !== 0) {
    return loc_264c(m);
  }

  // Expired: reload the timer to its full period and reverse the object's step-direction
  // sign, then run the shared tail. The reversal helper flips the byte it is pointed at.
  mem.write8(M50_OBJ2_REVERSE_TIMER, 0xc0);
  regs.hl = M50_OBJ2_STEP_DIR;
  reverseStepDirection(m);
  return loc_264c(m);
}
