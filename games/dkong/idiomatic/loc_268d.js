// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_268d — publish object-3's step and, every 32nd frame, advance its sprite pair.  ROM 0x268D.
 *
 * The shared tail of sub_2679 (object-3's per-frame update inside the 50m object
 * cascade, so it only runs on BOARD 2 and never in attract). Each pass it does two
 * things:
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
 * REGISTER-ABI MARSHALLING (dissolves once the callees take honest args): both callees
 * still read their inputs from registers, so this routine loads exactly what the
 * oracle's call sites load — the latch address before signStepHalfRate (it reads the
 * pointer and returns the step), and the sprite-pair base plus the latch address (as
 * the arm-select pointer) before loc_26a6.
 *
 * NAME: kept the neutral loc_ — the mechanics are pinned to the oracle, but the
 * on-screen object this animates is unconfirmed (the same sprite-record trap that keeps
 * its loc_26a6 callee neutral), and its published/animated cells (0x63A6, 0x69F4) are
 * unnamed. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-268d.test.js.
 * GATE:     crafted-entry + captured — plain attract never dispatches 0x268D (the whole
 *           sub_25F2 object cascade is board-2 gated and attract plays 25m), so real
 *           states are reproduced by driving the translated caller sub_2679 with the
 *           frame counter set to each branch (even -> the sprite-pair-advance arm, odd
 *           -> the publish-then-return arm), plus crafted entries that poke the latch
 *           sign (both loc_26a6 arms), the counter values (ordinary steps + wrap seams),
 *           and the shadow seed. Teeth: a dropped-publish twin and a dropped-frame-gate
 *           twin.
 * LIVE-OUT: memory-only. The step left behind is dead — the only exit successor
 *           (sub_2AD3) reloads the accumulator with Mario's X on its first instruction
 *           before reading it, and likewise recomputes flags — so nothing downstream
 *           consumes a register this routine leaves. The oracle's terminal `ret` is
 *           modelled by the JS return.
 * NAMES:    M50_OBJ3_STEP_DIR (0x62A6), FRAME (0x601A) — from ram.js. The published
 *           shadow (0x63A6) and the sprite-pair base (0x69F4) have no ram.js name yet;
 *           they stay hex here (0x69F4 is a SPRITE_BUFFER code byte, addressed
 *           relatively per loc_26a6's note).
 */

import { M50_OBJ3_STEP_DIR, FRAME } from "./ram.js";
import { signStepHalfRate } from "./signStepHalfRate.js"; // ROM 0x26E9
import { loc_26a6 } from "./loc_26a6.js"; // ROM 0x26A6

// Object-3's published step shadow, read by the 50m platform mover (no ram.js name yet).
const OBJ3_STEP_SHADOW = 0x63a6;
// Base of object-3's mirrored sprite-code pair in SPRITE_BUFFER (kept hex per loc_26a6's note).
const OBJ3_SPRITE_PAIR = 0x69f4;

export function loc_268d(m) {
  const { regs, mem } = m;

  // Reduce object-3's direction latch to a ±1 unit step (rewritten only on odd frames)
  // and publish that step to the shadow the mover reads. signStepHalfRate reads the
  // latch address from the pointer register and leaves the step in the accumulator.
  regs.hl = M50_OBJ3_STEP_DIR;
  signStepHalfRate(m);
  mem.write8(OBJ3_STEP_SHADOW, regs.a);

  // Only every 32nd frame (low 5 bits of the frame counter == 2) advance the sprite pair.
  if ((mem.read8(FRAME) & 0x1f) !== 0x02) return;

  // Step object-3's mirrored sprite-code pair, taking its direction from the sign latch
  // just published. loc_26a6 reads the pair base from the pointer register and the
  // arm-select byte through the second pointer (which addresses the same latch).
  regs.hl = OBJ3_SPRITE_PAIR;
  regs.de = M50_OBJ3_STEP_DIR;
  loc_26a6(m);
}
