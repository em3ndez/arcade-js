// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { aimClimberAtDeepestColumn } from "./aimClimberAtDeepestColumn.js";
import { SCRIPT_BRANCH_FLAG, ENEMY_SEGMENT, LANE_LIMIT, ENEMY_DEPTH, LANE_TARGET_FLAG, ENEMY_SLOT_DIR, ENEMY_SLOT_FLAGS, FIRE_GATE } from "./names.js";

/**
 * advanceClimberTrackingColumnMin — advance one climber enemy toward the rim while tracking each
 * column's shallowest occupant. ROM 0x9fc4 (per-slot climber step + column-min bookkeeping).
 *
 * Role in the machine: Tempest's tube has a fixed set of columns (lanes), and enemy "climbers" walk up
 * them toward the rim where the player sits. This routine services one enemy slot (index x) each pass. Two
 * jobs share the code: it nudges the slot's depth bookkeeping toward the rim, and it maintains a per-column
 * running minimum -- the depth of the closest (shallowest) enemy in that lane -- which the aim/targeting
 * logic reads to decide which column is most threatening. Depth runs 0xff at the far end down toward 0x00
 * at the rim, so a smaller value means nearer the player.
 *
 * Behavior: raises the script-branch flag ($10c=1) as an in-progress marker, reads the slot's column from
 * ENEMY_SEGMENT,x and seeds an empty column min-cell (LANE_LIMIT,col) to 0xf1. If this slot's depth
 * (ENEMY_DEPTH,x) beats the stored column min it records the new minimum and tags the lane
 * (LANE_TARGET_FLAG,col=0x80). Then it dispatches on the depth: below 0x20 is too shallow -- set bit7 of
 * ENEMY_SLOT_DIR,x, clamp depth to 0x20, and bail; between 0x20 and 0xf1 is mid-range and nothing more is
 * done; at/past 0xf2 the slot has run off the far limit, so it calls aimClimberAtDeepestColumn to re-target,
 * reparks depth at 0xf0, and -- only when the fire-gate ($3ab) is clear -- rewrites the slot's direction
 * (low bits -> 0x01) and flag/lane fields (low bits -> 0x02) and drops the script-branch flag back to 0.
 *
 * Live-out: the script-branch flag $10c, the per-column min LANE_LIMIT,col and its lane tag
 * LANE_TARGET_FLAG,col, the slot's depth ENEMY_DEPTH,x, and (on the far-limit path) ENEMY_SLOT_DIR,x and
 * ENEMY_SLOT_FLAGS,x. Grounding: [seen].
 */
export function advanceClimberTrackingColumnMin(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[SCRIPT_BRANCH_FLAG] = 1;                    // mark this slot's step as in progress
  const col = mem8[u16(ENEMY_SEGMENT + x)];        // the tube column (lane) this climber occupies
  const colAddr = u16(LANE_LIMIT + col);           // that column's running-minimum cell
  if (mem8[colAddr] === 0) mem8[colAddr] = 0xf1;   // an untouched column starts far out (0xf1)

  const depthAddr = u16(ENEMY_DEPTH + x);          // this slot's depth (smaller = nearer the rim)
  if (mem8[depthAddr] < mem8[colAddr]) {           // fresh minimum for this column
    mem8[colAddr] = mem8[depthAddr];               // record the new shallowest depth
    mem8[u16(LANE_TARGET_FLAG + col)] = 0x80;      // tag the lane as the closest-occupant column
  }

  const depth = mem8[depthAddr];
  if (depth < 0x20) {                              // too shallow -> flag and clamp
    mem8[u16(ENEMY_SLOT_DIR + x)] |= 0x80;         // set the slot's near-rim direction bit
    mem8[depthAddr] = 0x20;                        // clamp depth to the shallow floor
    return;
  }
  if (depth < 0xf2) return;                        // mid-range -> nothing more

  aimClimberAtDeepestColumn(m, x);                 // past the far limit -> pick a new column
  mem8[depthAddr] = 0xf0;                          // repark the slot just inside the far limit
  if (mem8[FIRE_GATE] !== 0) return;               // fire-gate busy -> leave the flag/lane fields alone

  // Fire-gate clear: rewrite the slot's direction (low 2 bits -> 01) and flag/lane (low 3 bits -> 010),
  // then drop the in-progress marker to signal the step completed cleanly.
  mem8[u16(ENEMY_SLOT_DIR + x)] = (mem8[u16(ENEMY_SLOT_DIR + x)] & 0xfc) | 0x01;
  mem8[u16(ENEMY_SLOT_FLAGS + x)] = (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0xf8) | 0x02;
  mem8[SCRIPT_BRANCH_FLAG] = 0;                     // clear the in-progress marker
}
