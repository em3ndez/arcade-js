// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SEGMENT, ENEMY_DEPTH, LANE_LIMIT, SCRIPT_BRANCH_FLAG } from "./names.js";

/**
 * setFlagIfSlotPastSegmentBound — a script "boundary-test" opcode that flags whether a slot has reached
 * the depth limit of its tube segment. ROM 0x9c21.
 *
 * Role in the machine: enemies and shots travel along the tube lanes; the script interpreter needs to
 * know when a given object slot has run out to the far (or near) boundary of the lane it occupies so it
 * can branch — spawn, turn, fire, or retire. This opcode reads the slot's current lane segment, looks up
 * that segment's boundary depth from the per-lane limit table, and leaves a 1/0 verdict in the shared
 * branch flag (SCRIPT_BRANCH_FLAG, loc_10c) for the interpreter to test.
 *
 * Behavior: for slot X, read its segment index from ENEMY_SEGMENT (loc_2b9,x) and index the boundary
 * table LANE_LIMIT (loc_3ac) by it. A zero table entry is a sentinel meaning "no limit", so it reads as
 * the maximum 0xff. Set the flag to 1 when the boundary is at or beyond the slot's depth coordinate
 * ENEMY_DEPTH (loc_2df,x), else 0.
 *
 * Live-out: SCRIPT_BRANCH_FLAG (loc_10c) — 1 or 0. No registers.
 *
 * Grounding: [seen]
 */
export function setFlagIfSlotPastSegmentBound(m, x = m.regs.x) {
  const { mem8 } = m;
  // Which tube segment this slot is on.
  const segment = mem8[u16(ENEMY_SEGMENT + x)];
  // That segment's boundary depth.
  let bound = mem8[u16(LANE_LIMIT + segment)];
  if (bound === 0) bound = 0xff; // a zero entry reads as the maximum bound
  // Flag 1 when the boundary is at or beyond the slot's depth, else 0.
  mem8[SCRIPT_BRANCH_FLAG] = bound >= mem8[u16(ENEMY_DEPTH + x)] ? 1 : 0;
}
