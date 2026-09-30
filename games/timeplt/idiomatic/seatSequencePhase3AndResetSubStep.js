// SPDX-License-Identifier: GPL-3.0-only
/**
 * seatSequencePhase3AndResetSubStep — jump the sequence machine to its last outer phase and restart the
 * inner index at zero.
 *
 * WHAT IT IS: ROM routine 0x172A [seen]. The machine's top level is a two-level sequence: an OUTER
 * phase, SEQUENCE_PHASE, which the vertical-blank service masks to two bits and dispatches on, and an
 * INNER index, SEQUENCE_SUBSTEP, which each phase's arms dispatch on in turn. Four outer values occur:
 * 0 the boot wipe, 1 the attract sequence, 2 the credit / push-start state, and 3 the round engine.
 *
 * ROLE IN THE MACHINE: this seats phase 3, the round engine, at its first sub-step. Both stores are
 * constants and neither cell is read first, so this is an unconditional jump of the sequence machine
 * to a fixed place rather than a step of it. Every phase-entry site writes the pair in this same idiom:
 * set the outer cell to a small constant, zero the inner one.
 *
 * LIVE-OUT: memory only -- those two cells.
 */

import { SEQUENCE_PHASE, SEQUENCE_SUBSTEP } from "./names.js";

/** The fourth and last outer phase: the round engine. */
const LAST_PHASE = 3;

export function seatSequencePhase3AndResetSubStep(m) {
  const { mem8 } = m;
  // Seat the outer phase first, then zero the inner index, so the next vertical blank dispatches
  // into phase 3 and that phase's dispatcher starts at its sub-step 0 (ROM `ld (0xa9ab),a` with 3,
  // then `xor a` / `ld (0xa9ac),a`).
  mem8[SEQUENCE_PHASE] = LAST_PHASE;
  mem8[SEQUENCE_SUBSTEP] = 0;
}
