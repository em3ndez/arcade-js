// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_268d — publish object-3's step and, every 32nd frame, advance its sprite pair.
 *
 * The shared tail of object-3's per-frame update inside the 50m object cascade, so it runs
 * on the 50m board only. Each pass it does two things:
 *
 *   1. Reduce object-3's direction latch (M50_OBJ3_STEP_DIR) to a ±1 unit step and
 *      publish that step to the shadow byte the 50m platform mover reads. The
 *      reduce-to-sign helper only rewrites the latch on odd frames; on even frames it
 *      yields a zero step and leaves the latch alone — so the published shadow pulses
 *      0 / ±1 across frames (a fixed-direction step delivered at half the frame rate).
 *   2. Only on every 32nd frame — when the low 5 bits of the frame counter equal 2 —
 *      advance object-3's mirrored sprite-code pair one step, taking its direction
 *      from the sign latch just reduced. On the other 31 frames it stops after the
 *      publish. (Note the 32-frame gate only opens on EVEN frames, so the animation
 *      always advances on a frame where the latch was NOT rewritten.)
 *
 * Both callees still read their inputs from registers, so this routine stages exactly what
 * each reads: the latch address before the reduce-to-sign step (which reads through that
 * pointer and hands back the step), and the sprite-pair base plus the latch address — used
 * as the arm-select pointer — before the sprite-pair step.
 *
 * NOT CLAIMED: which on-screen object this animates. Its published step carries a shared
 * name; the animated sprite-pair cell does not.
 *
 * LIVE-OUT: memory-only — the published step shadow every pass, and object-3's sprite-pair
 * counters on the 32nd-frame arm.
 */

import { M50_OBJ3_STEP_DIR, M50_OBJ3_STEP, FRAME } from "./names.js";
import { signStepHalfRate } from "./signStepHalfRate.js";
import { loc_26a6 } from "./loc_26a6.js";

// Base of object-3's mirrored sprite-code pair inside the sprite shadow buffer. It carries no
// shared name, so it is file-local here.
const OBJ3_SPRITE_PAIR = 0x69f4;

export function loc_268d(m) {
  const { regs, mem } = m;

  // Reduce object-3's direction latch to a ±1 unit step (rewritten only on odd frames)
  // and publish that step to the shadow the mover reads. The reduce-to-sign step reads the
  // latch address from the pointer register and leaves the step in the accumulator.
  regs.hl = M50_OBJ3_STEP_DIR;
  signStepHalfRate(m);
  mem.write8(M50_OBJ3_STEP, regs.a);

  // Only every 32nd frame (low 5 bits of the frame counter == 2) advance the sprite pair.
  if ((mem.read8(FRAME) & 0x1f) !== 0x02) return;

  // Step object-3's mirrored sprite-code pair, taking its direction from the sign latch
  // just published. The sprite-pair step reads the pair base from the pointer register and
  // the arm-select byte through the second pointer, which addresses the same latch.
  regs.hl = OBJ3_SPRITE_PAIR;
  regs.de = M50_OBJ3_STEP_DIR;
  loc_26a6(m);
}
