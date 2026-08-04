// SPDX-License-Identifier: GPL-3.0-only
/**
 * killMarioAtEndOfLiftTravel — Mario has been carried to the end of his run on a 75m
 * lift, so kill him and take him off the lift.
 *
 * The two lift carries tail into here the moment Mario's Y leaves the band their arm
 * allows. The up-carry steps his Y down by one, which is UP the screen because larger
 * Y is lower, and lands here once his row is numerically below 113 — row 112 or higher
 * up the screen. The down-carry steps his Y up by one, which is DOWN, and lands here at
 * row 232 or beyond. This routine then unconditionally clears two cells and returns:
 * MARIO_ACTIVE goes to 0 and EDGE_REPOSITION_FLAG is cleared. There are no inputs, no
 * branches and no callees — it always writes the same two zeros.
 *
 * ZEROING MARIO_ACTIVE IS THE GAME'S KILL PRIMITIVE, not merely "switching the mover
 * off". It freezes Mario and runs the death animation, then the life decrement, then
 * the respawn — measured end to end on both lift arms. A fatal landing makes the same
 * write from its own site, so the two death paths stay distinguishable by their writer,
 * and nothing here claims the fall is what killed him: this routine's own write is the
 * cause of record.
 *
 * WHAT "END OF LIFT TRAVEL" MEASURES — Mario's travel, not the lift's. Both carries
 * compare an ABSOLUTE Mario row against a constant and read no object record, so the
 * name is the lift-relative reading of a test that is really about Mario's row, and the
 * two places do not coincide. A rider's Y is stamped 12 below the platform's when he
 * boards and the gap measures 11-12 all ride, so on the UP arm he is killed at row 112
 * with the platform around row 123-124, while the rising column runs on another 27-28
 * px — about 18% of its 152 px climb — after he is dead. He dies at the top of HIS run
 * and the platform carries on past him. On the DOWN arm the same gap is only 4-5 px
 * (row 232 against the column's 248). So the name is exact for neither arm and loose by
 * 27-28 px for the up one: it names the situation, not the comparison.
 *
 * THERE IS NO SHAFT. The pixels show an exposed vertical rail with a riveted drive
 * housing at each end — the two ends being exactly the limits the moving column runs
 * between — carrying a 16x8 X-braced truss platform. No enclosure, no car.
 *
 * A THIRD ENTRY EXISTS and is NOT "the end of lift travel": Mario dropping off the
 * bottom of a 75m board (row 240 or beyond) reaches the same write. It has never been
 * observed. The name survives because it is a statement about the WRITE, which is
 * byte-identical on all three paths; the qualifier describes the two paths that were
 * measured.
 *
 * A LEAF: writes MARIO_ACTIVE and EDGE_REPOSITION_FLAG; calls nothing and returns
 * nothing.
 *
 * LIVE-OUT: memory-only (MARIO_ACTIVE, EDGE_REPOSITION_FLAG).
 */

import { MARIO_ACTIVE, EDGE_REPOSITION_FLAG } from "./names.js";

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
