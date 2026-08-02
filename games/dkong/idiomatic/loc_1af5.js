// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1af5 — the LEFT arm of Mario's ground-movement direction dispatch.  ROM 0x1AF5.
 *
 * The movement machine reaches here every frame it has decided Mario is on his feet and
 * has already declined the rightward step. Two things are handed over from the arm above:
 * the frame's cooked control word (bit 0 Right, bit 1 Left, bit 2 Up, bit 3 Down, bit 7
 * jump press-edge — the byte the input builder publishes in P1_INPUT), and the LEFT half of
 * the horizontal position gate's two-flag verdict, which reads 1 when Mario is standing
 * against a leftward playfield limit. That is not only the far-left screen edge: the same
 * verdict fires for an interior wall at the left end of the top platform on the odd boards,
 * which is why the airborne reflection routine calls it a playfield limit rather than a
 * screen edge.
 *
 * So the decision is a two-term gate: walk Mario one frame LEFT only when the player is
 * holding Left AND the position gate has not blocked leftward motion. On every other frame
 * — Left not held, or held but blocked — the frame falls through to the ladder/climb
 * collision handler, which is where the Up and Down directions are serviced. Refusing the
 * walk by falling through rather than returning is what keeps a refused frame available to
 * the climb path instead of discarding it.
 *
 * MIRROR. The arm immediately above (ROM 0x1AE6) is the same gate for the other direction,
 * and differs in exactly three things: it tests the control word's bit 0 (Right) where this
 * tests bit 1 (Left); it consults the position gate's RIGHT verdict where this consults the
 * LEFT one; and it steps into walkMarioRight where this steps into walkMarioLeft. It also
 * does the work this arm inherits — it is the arm that calls the position gate and loads the
 * control word, so this routine reads neither itself. Both arms converge on the same
 * fall-through target, so the pair reads as one three-way dispatch: step right, step left, or
 * hand the frame to the climb path.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1af5.test.js.
 * GATE:     real captured attract dispatches PLUS crafted entries for the arm attract never
 *           reaches. Measured: 1422 dispatches in 9000 attract frames, covering the walk-left
 *           arm (745) and the fall-through arm (677) — but the left-limit flag is 0 at every
 *           single one, so the BLOCKED arm is never naturally reached and crafted entries
 *           carry it alone. The crafted set is exhaustive over the whole decision surface:
 *           all 256 control words against a limit flag of 0, 1, 2 and 255, seeded from real
 *           captures. Teeth: a dropped left-limit gate, an inverted one, the sibling's
 *           bit-0 (Right) test, and the sibling's rightward stepper — each caught.
 * LIVE-OUT: memory-only, plus the RETURN VALUE. Everything this routine writes is written by
 *           the callee it selects. It is entered by a jump or a fall-through and leaves by a
 *           jump, so the chain nets exactly one caller-return, which the gate's pc + SP pins. The
 *           return propagates up the movement cascade where a truthy value would read as a
 *           caller-skip, so it must stay undefined on both arms (it is, measured on every
 *           captured dispatch and every crafted one). The decremented limit flag and the
 *           flags the oracle leaves behind are dead: neither callee reads them, and the
 *           cascade above discards everything but memory.
 * NAMES:    no ram.js cell is read here — both inputs arrive in the register file from the
 *           caller at ROM 0x1AE6, which is now idiomatic too (it landed in the same batch and
 *           direct-calls this routine). The register hand-off is therefore a live ABI between
 *           two idiomatic routines, not an oracle boundary; promoting it to parameters is a
 *           clarify-pass job for the pair. The control word it hands over is the value of P1_INPUT
 *           (0x6010), which it loaded one instruction earlier and nothing writes in between —
 *           asserted by the gate's reachability test over all 400 cloned dispatches, not taken
 *           on faith, since it is the justification for the register read. walkMarioLeft
 *           (ROM 0x1CAB) and loc_1afe (ROM 0x1AFE) are already idiomatic and called directly.
 */

import { walkMarioLeft } from "./walkMarioLeft.js"; // ROM 0x1CAB
import { loc_1afe } from "./loc_1afe.js";           // ROM 0x1AFE — ladder/climb collision

// Bit 1 of the cooked control word: the player is holding Left.
// (The sibling arm at ROM 0x1AE6 tests bit 0, Right.)
const LEFT_HELD = 0x02;

// The horizontal position gate's left verdict reads exactly 1 when leftward motion is
// blocked; every other value leaves the walk open.
const LEFT_BLOCKED = 1;

/**
 * @param {import("../machine.js").Machine} m
 * @returns {void}
 */
export function loc_1af5(m) {
  const { regs } = m;

  // Handed over by the arm above: the left-limit verdict and this frame's control word.
  const leftLimit = regs.d;
  const control = regs.a;

  // Holding Left with room to move: spend the frame on one leftward walk step.
  if (leftLimit !== LEFT_BLOCKED && (control & LEFT_HELD) !== 0) {
    return walkMarioLeft(m);
  }

  // Otherwise the frame belongs to the ladder/climb collision handler.
  return loc_1afe(m);
}
