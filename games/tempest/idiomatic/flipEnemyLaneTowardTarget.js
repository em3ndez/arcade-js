// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, TUBE_GEOM_FLAG, SCRIPT_CURSOR, POKEY1_RANDOM } from "./names.js";
import { faceEnemyTowardPlayerSegment } from "./faceEnemyTowardPlayerSegment.js";
import { toggleEnemyTurnSide } from "./toggleEnemyTurnSide.js";
import { stepClimberSegmentAndHeading } from "./stepClimberSegmentAndHeading.js";

/**
 * flipEnemyLaneTowardTarget — take a flipper one lane-hop around the tube toward the player. ROM 0x9f81.
 *
 * Role in the machine: a flipper walks the rim of the tube by hopping between adjacent lanes. Each step it
 * must pick a turn side (clockwise vs counter-clockwise, held in bit6 of the slot's flag byte loc_283,x)
 * and then advance one lane. This is the "toward the target" entry; flipEnemyLaneRandomSide is the wander
 * variant that picks its side from noise instead. Both funnel into the shared tail and then the actual
 * segment/heading advance.
 *
 * Behavior (toward): re-derive the turn side toward the player via faceEnemyTowardPlayerSegment (sets/clears
 * bit6 by the shorter ring direction), then toggleEnemyTurnSide flips bit6 — so the flipper alternates the
 * side it presents while still biasing toward the player — then falls into the shared tail.
 *
 * Behavior (random): clear bit6, then reseed it from POKEY1 noise (loc_60ca bit6) so the flipper turns an
 * arbitrary way, then the shared tail.
 *
 * Shared tail (step9f99): only on a live board (TUBE_GEOM_FLAG loc_111 != 0) does it force a turn at the
 * ring extremes — reading the slot's ring position loc_2b9,x (ENEMY_SEGMENT), it flips bit6 when a
 * bit6-set slot has wrapped to position 0, or a bit6-clear slot has reached the far end (>= 0x0f). It then
 * marks the script cursor loc_10b (SCRIPT_CURSOR) = 0x66 for the pending step and tail-calls
 * stepClimberSegmentAndHeading, which performs the lane-to-adjacent-lane hop.
 *
 * Live-out: bit6 of loc_283,x (final turn side), loc_10b = 0x66, plus whatever stepClimberSegmentAndHeading
 * writes (the slot's new segment/heading). Grounding: [seen].
 */
// Entry: re-derive the slot's bit6 from its target, toggle it, then run the shared step.
export function flipEnemyLaneTowardTarget(m, x = m.regs.x) {
  faceEnemyTowardPlayerSegment(m, x); // bias bit6 toward the player's lane
  toggleEnemyTurnSide(m, x);          // then flip it -- alternate the presented side
  return step9f99(m, x);
}

// Entry: reseed the slot's bit6 from a random bit before the shared step.
export function flipEnemyLaneRandomSide(m, x = m.regs.x) {
  const { mem8 } = m;
  const e = u16(ENEMY_SLOT_FLAGS + x);
  let flag = mem8[e] & 0xbf;                 // clear bit6
  if (mem8[POKEY1_RANDOM] & 0x40) flag |= 0x40;   // random bit6 reseeds it
  mem8[e] = flag;
  return step9f99(m, x);
}

// Shared tail: on a live board, force a turn at the ring extremes, mark the pending step, then advance.
function step9f99(m, x) {
  const { mem8 } = m;
  if (mem8[TUBE_GEOM_FLAG] !== 0) {                    // only when the board geometry is live
    const e = u16(ENEMY_SLOT_FLAGS + x);
    const depth = mem8[u16(ENEMY_SEGMENT + x)];        // slot's ring position loc_2b9,x
    const flip = (mem8[e] & 0x40) ? depth === 0 : depth >= 0x0f; // hit the near/far extreme -> reverse
    if (flip) mem8[e] ^= 0x40;
  }
  mem8[SCRIPT_CURSOR] = 0x66;                          // stage the pending step
  return stepClimberSegmentAndHeading(m, x);           // perform the lane-to-adjacent-lane hop
}
