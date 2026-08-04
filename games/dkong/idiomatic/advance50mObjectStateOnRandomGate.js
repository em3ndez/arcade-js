// SPDX-License-Identifier: GPL-3.0-only
/**
 * advance50mObjectStateOnRandomGate — advance a board object to its next state, on a randomised pacing gate.  ROM 0x2299.
 *
 * One arm of the four-state update machine that dispatch50mObjectState runs for a board object.
 * That caller picks the object's record base (0x6280 on odd frames, 0x6288 on even),
 * reads the record's state byte, and dispatches on it to one of four arms; this arm
 * runs while the object sits in the state that selects it. The record base arrives as
 * the caller-supplied pointer — the record's own state byte is at that address.
 *
 * The body is a randomised dwell: it samples the shared RANDOM accumulator and steps
 * the object's state byte to the next state ONLY on the fraction of frames where the
 * four selected bits (mask 0x3C) all happen to be clear — roughly one frame in sixteen.
 * On every other frame the gate is closed and the object lingers in this state. So the
 * object holds here for a random spell and then advances, rather than stepping on a
 * fixed cadence.
 *
 * A LEAF: reads RANDOM, reads and (when the gate opens) increments the state byte at the
 * caller-supplied record base; calls nothing and returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2299.test.js.
 * GATE:     exhaustive — all 256 RANDOM values decide the gate completely, swept against
 *           both real record bases (0x6280/0x6288) and boundary state bytes (including the
 *           0xFF->0x00 wrap), plus crafted entries on a real attract base. 0x2299 is NOT
 *           naturally dispatched in attract — dispatch50mObjectState runs every frame there but its
 *           object machine never reaches this arm — so there are no captured dispatches;
 *           the exhaustive gate sweep is the proof. Teeth: an inverted-gate twin and a
 *           dropped-advance twin.
 * LIVE-OUT: memory-only — the single state-byte write. This arm is a fire-and-forget tail
 *           of dispatch50mObjectState's per-object dispatch; nothing downstream consumes a register or
 *           flag. The oracle reaches this body by a jump with the record base already on
 *           the stack (its `pop hl`) and returns with `ret`; modelled honestly as a
 *           record-base PARAMETER and an ordinary function return, so no stack is touched.
 * NAMES:    RANDOM (0x6018) from names.js. recordBase is the caller's record-base pointer
 *           (0x6280/0x6288 = BOARD_OBJ_SCRATCH and +8 in play), a parameter, not a cell.
 *           The 0x3C bit-mask stays hex — it selects specific bits of the accumulator.
 */

import { RANDOM } from "./names.js";

/**
 * @param {object} m           the machine (uses m.mem only).
 * @param {number} recordBase  address of the object's state byte (the record base the
 *                             caller supplies; 0x6280/0x6288 in play).
 * @returns {void}
 */
export function advance50mObjectStateOnRandomGate(m, recordBase) {
  const { mem } = m;

  // Randomised pacing gate: advance only when the four selected bits of the RANDOM
  // accumulator are all clear (about one frame in sixteen); otherwise linger.
  if ((mem.read8(RANDOM) & 0x3c) !== 0) return;

  // Gate open: step the object to its next state.
  mem.write8(recordBase, mem.read8(recordBase) + 1);
}
