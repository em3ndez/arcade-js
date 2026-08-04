// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_264c — publish object-2's ±1 step in both polarities and, every 32nd frame,
 * advance its mirrored sprite pair.  ROM 0x264C.
 *
 * The shared tail of sub_262f (object-2's per-frame update inside the 50m object
 * cascade, so it only runs on BOARD 2 and never in attract). Each pass it does two
 * things:
 *
 *   1. Reduce object-2's direction latch (M50_OBJ2_STEP_DIR) to a ±1 unit step and
 *      publish it to BOTH shadow bytes the 50m mover reads: the step itself to the
 *      positive shadow M50_OBJ2_STEP_POS (0x63A5) and its negation to the negative shadow
 *      M50_OBJ2_STEP_NEG (0x63A4), so the mover has the move ready in either direction. The reduce-to-sign helper only
 *      rewrites the latch on odd frames; on even frames it yields a zero step and leaves
 *      the latch alone — so both shadows pulse 0 / ±1 across frames (a fixed-direction
 *      step delivered at half the frame rate; on an even frame both shadows publish 0).
 *   2. Only on every 32nd frame — when the low 5 bits of the frame counter are zero —
 *      advance object-2's mirrored sprite-code pair one step, its direction taken from
 *      object-2's reverse-timer (the byte one below the latch). On the other 31 frames
 *      it stops after the publish. (That gate only opens on EVEN frames, where the latch
 *      was NOT rewritten.) The pair's low cell is then re-stamped with the high cell's
 *      stepped value, its top (horizontal-flip) bit cleared.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the callees take honest args): both callees
 * still read their inputs from registers, so this routine loads exactly what the oracle's
 * call sites load — the latch address before signStepHalfRate (it reads the pointer and
 * returns the step), and the sprite-pair base plus the reverse-timer address (as the
 * arm-select pointer) before loc_26a6, whose result it then reads back.
 *
 * NAME: kept the neutral loc_ — the mechanics are pinned to the oracle, but the on-screen
 * object this animates is unconfirmed (the same sprite-record trap that keeps its loc_26a6
 * callee neutral); its published shadows and reverse-timer are now named (M50_OBJ2_STEP_POS/
 * NEG, M50_OBJ2_REVERSE_TIMER) while its animated sprite cells (the 0x69EC block) stay
 * unnamed. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-264c.test.js.
 * GATE:     crafted-entry + captured — plain attract never dispatches 0x264C (the whole
 *           sub_25F2 object cascade is board-2 gated and attract plays 25m), so real
 *           states are reproduced by driving the translated caller sub_262f with the frame
 *           counter set to each branch (odd -> the publish-then-return arm; even with low 5
 *           bits zero -> the sprite-pair-advance arm), plus crafted entries that poke the
 *           latch sign (both shadows), the reverse-timer's direction bit (both loc_26a6
 *           arms), the pair counters (ordinary steps + all four wrap seams), and the shadow
 *           seeds. Teeth: a dropped-negate-publish twin, a dropped-frame-gate twin, and a
 *           dropped-flip-bit-mask twin.
 * LIVE-OUT: memory-only. The masked value left in the accumulator is dead — the exit
 *           successor sub_2679 reloads the accumulator with the frame counter on its first
 *           instruction (and recomputes flags), so nothing downstream consumes a register
 *           this routine leaves. The oracle's terminal `ret` is modelled by the JS return.
 * NAMES:    M50_OBJ2_STEP_DIR (0x62A3), the two published shadows M50_OBJ2_STEP_POS (0x63A5) /
 *           M50_OBJ2_STEP_NEG (0x63A4), object-2's reverse-timer M50_OBJ2_REVERSE_TIMER (0x62A2,
 *           one below the latch, sibling of M50_OBJ1_REVERSE_TIMER), and FRAME (0x601A) — all
 *           from names.js. The sprite-pair cells (the 0x69EC block, SPRITE_BUFFER code bytes
 *           addressed relatively per loc_26a6's note) have no names.js name yet and stay hex here.
 */

import { u8 } from "../../../core/int.js";
import { M50_OBJ2_STEP_DIR, M50_OBJ2_STEP_POS, M50_OBJ2_STEP_NEG, M50_OBJ2_REVERSE_TIMER, FRAME } from "./names.js";
import { signStepHalfRate } from "./signStepHalfRate.js"; // ROM 0x26E9
import { loc_26a6 } from "./loc_26a6.js"; // ROM 0x26A6

// Base of object-2's mirrored sprite-code pair in SPRITE_BUFFER; loc_26a6 steps the low cell
// (base+1) and the high cell (base+5). Kept hex per loc_26a6's note.
const OBJ2_SPRITE_PAIR = 0x69ec;
const OBJ2_PAIR_LOW = 0x69ed; // the low cell, re-stamped below with the high cell's value.

export function loc_264c(m) {
  const { regs, mem } = m;

  // Reduce object-2's direction latch to a ±1 unit step (rewritten only on odd frames) and
  // publish both polarities the mover reads. signStepHalfRate reads the latch address from
  // the pointer register and leaves the step in the accumulator.
  regs.hl = M50_OBJ2_STEP_DIR;
  signStepHalfRate(m);
  const step = regs.a;
  mem.write8(M50_OBJ2_STEP_POS, step);
  mem.write8(M50_OBJ2_STEP_NEG, u8(-step));

  // Only every 32nd frame (low 5 bits of the frame counter zero) advance the sprite pair.
  if ((mem.read8(FRAME) & 0x1f) !== 0) return;

  // Step object-2's mirrored sprite-code pair, its direction taken from the reverse-timer's
  // top bit. loc_26a6 reads the pair base from the pointer register and the arm-select byte
  // through the second pointer, and returns the high cell's stepped value.
  regs.hl = OBJ2_SPRITE_PAIR;
  regs.de = M50_OBJ2_REVERSE_TIMER;
  loc_26a6(m);
  const pairHigh = regs.a;

  // Re-stamp the pair's low cell with the high cell's value, its top (horizontal-flip) bit
  // cleared.
  mem.write8(OBJ2_PAIR_LOW, pairHigh & 0x7f);
}
