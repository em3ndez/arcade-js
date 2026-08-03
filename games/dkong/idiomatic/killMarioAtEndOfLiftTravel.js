// SPDX-License-Identifier: GPL-3.0-only
/**
 * killMarioAtEndOfLiftTravel — Mario has been carried to the end of his run on a 75m lift,
 * so kill him and take him off the lift.  ROM 0x277F.
 *
 * The two lift carries tail into here the moment MARIO_Y leaves the band their arm allows:
 * carryMarioUpWithLift (ROM 0x276F) does MARIO_Y - 1, which is UP the screen because
 * larger Y is lower, and comes here below Y 0x71 — carried up to row 112 or above;
 * carryMarioDownWithLift (ROM 0x2787) does MARIO_Y + 1, which is DOWN, and comes here at
 * Y >= 0xE8 — row 232. It unconditionally clears two cells and returns: MARIO_ACTIVE goes
 * to 0 and EDGE_REPOSITION_FLAG (0x6398) is cleared. There are no inputs, no branches and
 * no callees — it always writes the same two zeros.
 *
 * WHAT "END OF LIFT TRAVEL" MEASURES — Mario's travel, not the lift's. Both call sites
 * compare an ABSOLUTE MARIO_Y row against a constant and read no object record, so the
 * name is the lift-relative reading of a test that is really about Mario's row, and the
 * two places do not coincide. A rider's Y is stamped OBJ_Y - 12 when he boards (ROM
 * 0x29E0-E2) and the gap measured 11-12 all ride, so on the UP arm he is killed at row 112
 * with the platform around OBJ_Y 123-124, while the rising column runs on to OBJ_Y 96 (ROM
 * 0x27B5) — 27-28 px, about 18% of its 152 px climb, still to go. He dies at the top of HIS
 * run and the platform carries on past him. On the DOWN arm the same gap is 4-5 px (row 232
 * against the column's OBJ_Y 248, ROM 0x27CE). So the name is exact for neither arm and
 * loose by 27-28 px for the up one: it names the situation, not the comparison. Nor is
 * there a SHAFT — the pixels show an exposed vertical rail with a riveted drive housing at
 * each end (sprite 0x45, spanning OBJ_Y 96 and 248, the ROM's own two limits) carrying a
 * 16x8 X-braced truss platform (sprite code 0x44 in gfx2.bin); no enclosure, no car.
 *
 * NAME: promoted from loc_277f in understanding pass 15 (proposer != confirmer; both
 * derivations said KILL, and both flagged that this header's old wording — "MARIO_ACTIVE goes
 * to 0 (the mover is switched off)" — was actively misleading. It reads as "the lift stops",
 * which is the opposite of what happens: the lift carries on and the player is
 * dead). Corroboration from OUTSIDE the routine (R5): MARIO_ACTIVE (0x6200) is `[seen]` in
 * ram.js and its grounded note states the consequence itself — "Poking 0 mid-play freezes
 * Mario and runs the death -> life-decrement -> respawn cycle". Zeroing it is the game's kill
 * primitive, the same write the fall-damage landing makes. It was then measured end to end on
 * BOTH arms, in two independent runs: MARIO_ACTIVE := 0 here, then GAME_SUBSTATE 0x0C -> 0x0D
 * and the pass-13-grounded 296-frame death animation, then substate 0x0E and LIVES 3 -> 2 —
 * 2/2, against a 1,260-frame idle control on the same board with Mario alive and 0 dispatches
 * here.
 *
 * WHAT THE NAME DOES NOT CLAIM, and one place it stretches: the routine has a THIRD call site
 * — service75mBoard, on MARIO_Y >= 0xF0, i.e. Mario off the bottom of a 75m board — which has never
 * been observed. That path is not "the end of lift travel". The name survives because it is a
 * statement about the WRITE, which is byte-identical on all three paths; the qualifier
 * describes the two call sites that were measured. Nothing here claims the fall is what kills
 * him: this routine's own write is the cause of record, and a landing death zeroes the same
 * cell from a different site in the landing path, so the two death paths stay distinguishable
 * by their writer.
 *
 * A LEAF: writes MARIO_ACTIVE and EDGE_REPOSITION_FLAG; calls nothing and returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-277f.test.js.
 * GATE:     exhaustive over the only thing that can vary — the prior contents of the
 *           two written cells (and noise in neighbours) — since the routine takes no
 *           input and always writes the same zeros. ★ The real-capture half of this
 *           gate is VACUOUS and always was: 0x277F is reachable only from 0x276F,
 *           0x2787 and service75mBoard, all board-3 paths, and the whole 75m family measured
 *           0 dispatches across 24,243 attract frames — so attract never reaches it
 *           and the crafted entries carry the gate alone. RAM diff is the whole dump
 *           (the oracle writes no stack — its terminal return only pops), so no
 *           STACK_SCRATCH exclusion is needed.
 * LIVE-OUT: memory-only (MARIO_ACTIVE, EDGE_REPOSITION_FLAG 0x6398). The oracle's
 *           cleared accumulator/flags and its terminal return are dead ABI — the
 *           per-frame chain that tail-calls this discards them.
 * NAMES:    MARIO_ACTIVE (0x6200) `[seen]`, EDGE_REPOSITION_FLAG (0x6398) from ram.js.
 *           The latter is still rated `[code]` there and described as a "Mario Y just
 *           repositioned" one-shot; this pass established its meaning more sharply from
 *           outside — it has exactly one setter in the ROM (0x29E8, in the land-on-a-lift
 *           arm), so it reads as "Mario is standing on a 75m lift". Lifting that rating
 *           is a ram.js edit, not this file's.
 */

import { MARIO_ACTIVE, EDGE_REPOSITION_FLAG } from "./ram.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function killMarioAtEndOfLiftTravel(m) {
  const { mem } = m;

  // Kill Mario (MARIO_ACTIVE = 0 runs the death -> life-lost -> respawn cycle) and take
  // him off the lift.
  mem.write8(MARIO_ACTIVE, 0);
  mem.write8(EDGE_REPOSITION_FLAG, 0);
}
