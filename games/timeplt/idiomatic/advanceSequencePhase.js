// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSequencePhase — advance the outer sequence phase and restart its inner step index at zero.
 *
 * ROM 0x0F11-0x0F19 (loc_0f11). Grounding: [seen] (names.js ROUTINES 0x0F11).
 *
 * What it is: the "next mode" move of the game's two-level sequence machine. The vertical-blank
 * service runs one arm of that machine every frame; SEQUENCE_PHASE (0xA9AB) [seen] is the OUTER
 * level — the machine's mode (power-on wipe, attract, credit/press-start, round engine) — and
 * SEQUENCE_SUBSTEP (0xA9AC) [seen] is the INNER index that picks which arm of that mode runs.
 * Moving to a new mode only makes sense starting from that mode's first arm, so both cells are
 * updated together here.
 *
 * Role in the machine: under MAME it executes zero times across a driven run — every read of its
 * entry byte is a checksum fold, none with the program counter at the address. That corroborates
 * that all but one of its callers sit behind an anti-tamper test and are dead on a genuine image
 * (a tampered image derails the sequence by stepping the phase when it should not).
 *
 * LIVE-OUT: SEQUENCE_PHASE and SEQUENCE_SUBSTEP; nothing is returned.
 */

import { SEQUENCE_PHASE, SEQUENCE_SUBSTEP } from "./names.js";

export function advanceSequencePhase(m) {
  const { mem8 } = m;
  // Step the outer phase: the ROM's `inc (hl)` on 0xA9AB. The byte store truncates to eight bits,
  // so a phase of 255 would wrap round to 0 exactly as the hardware increment does.
  mem8[SEQUENCE_PHASE] = mem8[SEQUENCE_PHASE] + 1;
  // Restart the inner index: `xor a / ld (0xa9ac),a`. It is an unconditional constant store, so
  // whatever sub-step the old phase had reached is discarded and the new phase begins at arm zero.
  mem8[SEQUENCE_SUBSTEP] = 0;
}
