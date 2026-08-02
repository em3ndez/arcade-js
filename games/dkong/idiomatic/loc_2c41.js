// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c41 — head of the bonus-event slot-claim cluster: stir the random seed, then route to one
 * of two slot-claim mode entries on the seed's low nibble.  ROM 0x2C41.
 *
 * The cluster's entry head. It stirs the once-per-vblank pseudo-random seed and reads its low
 * nibble as a 1-in-16 coin flip: on the 15-of-16 nonzero outcome it runs the mode-3 entry
 * (loc_2c86, which clears the slot-claim request flag up front); on the 1-of-16 zero outcome it
 * runs the mode-1 entry (loc_2c49). Both entries then run the shared periodic-event gate against
 * the caller's bonus value and, when the gate fires, claim the first free object slot — so this
 * head only decides which mode byte tags the claim and whether the request flag is pre-cleared,
 * leaving the actual scratch writes and slot scan to the chosen entry.
 *
 * The bonus value is the caller's register live-in; this head is still reached from the translated
 * cluster, so the two mode entries read it at that oracle boundary themselves — it is never touched
 * here (the seed stir leaves the caller's bonus register alone).
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md). The "slot claim" this cluster performs is what tags the next
 * 25m BARREL as the alternate KIND: on a claim the chain ends in loc_2c72 raising bit 7 of
 * BARREL_CLAIM_MODE, and one frame later stampReleasedBarrelKind reads that bit to pick which of two barrel
 * kinds it stamps into the freshly-released OBJ_ARRAY_67 record — bit 7 CLEAR -> sprite
 * code/attr/mode 0x15 / 0x0B / 0x00, bit 7 SET -> 0x19 / 0x0C / 0x01, agreeing 46/46 with no
 * exceptions (38 clear, 8 set). All 46 were ordinary board-1 25m gameplay dispatches (17 in a
 * credited in-board game, 29 in the attract demo, ZERO in the opening Kong-climb cutscene at
 * substate 7), each paired 1:1 with a slot claim by the barrel-release routine (board 1, ROM
 * 0x2CB8). The bit-7-SET (attr 0x0C) kind DROPS with its X pinned at 59; the bit-7-CLEAR (attr
 * 0x0B) kind ROLLS along the girders; the two coexist on screen. Grounding deliberately did NOT
 * establish which NAMED Donkey Kong object either kind is, so neither is named here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c41.test.js.
 * GATE:     crafted + captured. Exhaustive over the stirred seed byte (all 256, gate held closed
 *           with a pre-dirtied request flag) — pins the low-nibble branch selection and the
 *           delegated scratch writes on both arms; + crafted gate-open entries driving every
 *           first-free-slot position (records 0..4) and the all-occupied case on both arms (seed
 *           nibble forced 0 and nonzero), proving the claim tags BARREL_CLAIM_MODE with 0x81 on the
 *           mode-1 arm and 0x80 on the mode-3 arm; + real captured 0x2C41 dispatches from an attract run (which
 *           all land on the nonzero/mode-3 arm — the zero arm is the rare 1-in-16). The oracle's one
 *           dissolved push (modelling its `call 0x0057`) writes dead STACK_SCRATCH, excluded from the
 *           RAM diff. Teeth: an inverted branch, a dropped seed stir, and a dropped low-nibble mask.
 * LIVE-OUT: memory-only — the stirred seed (RANDOM) plus everything the chosen mode entry writes
 *           (BARREL_CLAIM_MODE, 0x638F, 0x6392, BONUS_EVENT_MARK). The oracle threads a residual
 *           accumulator and flags out and its terminal pop is dead; the translated callers reload
 *           before reading back.
 * NAMES:    stirRandomSeed (ROM 0x0057), loc_2c86 (ROM 0x2C86), loc_2c49 (ROM 0x2C49) direct-called.
 *           This head references no named work RAM directly — the seed cells (RANDOM/FRAME/SPIN_COUNT)
 *           live inside stirRandomSeed and the slot-claim cells inside the two mode entries;
 *           BARREL_CLAIM_MODE (0x6382), the barrel slot-claim mode byte whose low bits carry the
 *           claim's mode value and whose bit 7 selects the barrel kind, is imported from ram.js
 *           inside those entries.
 */

import { stirRandomSeed } from "./stirRandomSeed.js"; // ROM 0x0057 — mix the per-vblank random seed
import { loc_2c86 } from "./loc_2c86.js"; // ROM 0x2C86 — mode-3 entry (clears the request flag first)
import { loc_2c49 } from "./loc_2c49.js"; // ROM 0x2C49 — mode-1 entry

/**
 * @param {object} m  the machine. The bonus value arrives in a register (the translated cluster's
 *                    live-in) and is consumed by whichever mode entry this head selects.
 * @returns {void}
 */
export function loc_2c41(m) {
  const { regs } = m;

  // Stir the once-per-vblank random seed; stirRandomSeed leaves the fresh seed here.
  stirRandomSeed(m);
  const seed = regs.a;

  // The seed's low nibble picks the slot-claim mode: a nonzero nibble (15 of every 16 seeds) takes
  // the clear-then-mode-3 entry, a zero nibble (1 of 16) the mode-1 entry.
  if ((seed & 0x0f) !== 0) {
    loc_2c86(m);
  } else {
    loc_2c49(m);
  }
}
