// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_264c — publish object-2's ±1 step in both polarities and, every 32nd frame,
 * advance its mirrored sprite pair.
 *
 * The shared tail of object-2's per-frame update inside the 50m object cascade, so it runs
 * only on BOARD 2. Each pass it does two things:
 *
 *   1. Reduce object-2's direction latch (M50_OBJ2_STEP_DIR) to a ±1 unit step and publish
 *      it to BOTH shadow bytes the 50m mover reads: the step itself to the positive shadow
 *      M50_OBJ2_STEP_POS and its negation to the negative shadow M50_OBJ2_STEP_NEG, so the
 *      mover has the move ready in either direction. The shared reduce-to-sign helper only
 *      rewrites the latch on ODD frames; on even frames it yields a zero step and leaves the
 *      latch alone — so both shadows pulse 0 / ±1 across frames, a fixed-direction step
 *      delivered at half the frame rate, and on an even frame both shadows publish 0.
 *   2. Only on every 32nd frame — when the low 5 bits of the frame counter are zero —
 *      advance object-2's mirrored sprite-code pair one step, its direction taken from
 *      object-2's reverse timer (the byte one below the latch). On the other 31 frames it
 *      stops after the publish. That gate only opens on EVEN frames, where the latch was
 *      NOT rewritten. The pair's low cell is then re-stamped with the high cell's stepped
 *      value, its top (horizontal-flip) bit cleared.
 *
 * Both helpers still read their inputs from registers, so this routine loads the latch
 * address before the reduce-to-sign step, and the sprite-pair base plus the reverse-timer
 * address before the pair advance, then reads the stepped value back.
 *
 * NOT CLAIMED: which on-screen object this animates. Its published step shadows and its
 * reverse timer carry names; the sprite cells it steps do not.
 *
 * LIVE-OUT: memory-only — the two published shadows on every pass, plus the sprite-code pair
 * on the 32nd-frame arm.
 */

import { u8 } from "../../../core/int.js";
import { M50_OBJ2_STEP_DIR, M50_OBJ2_STEP_POS, M50_OBJ2_STEP_NEG, M50_OBJ2_REVERSE_TIMER, FRAME } from "./names.js";
import { signStepHalfRate } from "./signStepHalfRate.js";
import { loc_26a6 } from "./loc_26a6.js";

// Base of object-2's mirrored sprite-code pair in the sprite buffer. The pair advance steps
// the low cell (base+1) and the high cell (base+5); neither cell carries a shared name.
const OBJ2_SPRITE_PAIR = 0x69ec;
const OBJ2_PAIR_LOW = 0x69ed; // the low cell, re-stamped below with the high cell's value.

export function loc_264c(m) {
  const { regs, mem } = m;

  // Reduce object-2's direction latch to a ±1 unit step (rewritten only on odd frames) and
  // publish both polarities the mover reads. The helper reads the latch address from the
  // pointer register and hands the step back in the accumulator.
  regs.hl = M50_OBJ2_STEP_DIR;
  signStepHalfRate(m);
  const step = regs.a;
  mem.write8(M50_OBJ2_STEP_POS, step);
  mem.write8(M50_OBJ2_STEP_NEG, u8(-step));

  // Only every 32nd frame (low 5 bits of the frame counter zero) advance the sprite pair.
  if ((mem.read8(FRAME) & 0x1f) !== 0) return;

  // Step object-2's mirrored sprite-code pair, its direction taken from the reverse timer's
  // top bit. The pair advance reads the pair base from the pointer register and the
  // arm-select byte through the second pointer, and hands back the high cell's new value.
  regs.hl = OBJ2_SPRITE_PAIR;
  regs.de = M50_OBJ2_REVERSE_TIMER;
  loc_26a6(m);
  const pairHigh = regs.a;

  // Re-stamp the pair's low cell with the high cell's value, its top (horizontal-flip) bit
  // cleared.
  mem.write8(OBJ2_PAIR_LOW, pairHigh & 0x7f);
}
