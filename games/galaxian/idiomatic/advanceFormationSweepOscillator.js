// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFormationSweepOscillator (ROM 0x090d) -- the side-to-side march of the whole alien block.
 *
 * WHAT IT IS
 *   Every alien in the standing formation has a Y that tracks a single shared 16-bit anchor word at
 *   loc_420e (0x420e); positionObjectFromGridCell adds each alien's column term to that anchor. This
 *   routine sways the anchor: once every four frames it nudges it one unit toward the current end of
 *   its travel, and when it reaches a bound it flips direction, so the block oscillates. After each
 *   step it broadcasts the (negated) new low byte across the object shadow's coordinate lane so the
 *   shift actually reaches the hardware.
 *
 * ROLE IN THE MACHINE
 *   Part of the per-frame formation prep run by the game-state handlers (mechanisms.md, "The formation
 *   sway"). Travel is bounded by FORMATION_X_BOUNDS (0x4210): a low bound and a high bound derived from
 *   the block's horizontal extent. OBJ_SWEEP_DIRECTION (0x420d) picks ascending (0) vs descending; the
 *   step is throttled to one frame in four by the low two bits of FRAME_COUNTER (0x425f); the turns go
 *   through setSweepDescending (0x097d) at the upper bound and setSweepAscending (0x0983) at the lower.
 *   A leading proximity gate short-circuits the whole thing when the player's shot is armed and lined
 *   up on the currently-named column: it re-publishes the anchor without stepping (via
 *   broadcastNegatedFormationSweepToStridedTable) so the block does not slide the target column out
 *   from under an incoming shot on that frame.
 *
 * Grounding: [seen] (names.js cert for 0x090d).
 *
 * LIVE-OUT: loc_420e (the swept anchor, on a stepping frame), OBJ_SWEEP_DIRECTION (flipped at a bound),
 *   and the strided coordinate lane at 0x4028 rewritten via the broadcast helpers.
 */
import { u16 } from "../../../core/int.js";
import {
  loc_4208, loc_4209, loc_420a, loc_420e, FRAME_COUNTER,
  FORMATION_X_BOUNDS, OBJ_SWEEP_DIRECTION, COLUMN_OCCUPANCY,
} from "./names.js";
import { broadcastNegatedFormationSweepToStridedTable } from "./broadcastNegatedFormationSweepToStridedTable.js";
import { broadcastNegatedSweepToStridedTable } from "./broadcastNegatedSweepToStridedTable.js";
import { setSweepDescending } from "./setSweepDescending.js";
import { setSweepAscending } from "./setSweepAscending.js";

export function advanceFormationSweepOscillator(m) {
  const { mem8, mem16 } = m;

  // Proximity short-circuit: if the armed player shot is lined up on the swept column, re-broadcast the
  // current anchor without stepping so the target column stays put under the incoming shot this frame.
  if (proximityGateHit(mem8)) return broadcastNegatedFormationSweepToStridedTable(m);

  // Load the shared 16-bit formation anchor and its travel bounds.
  let word = mem16[loc_420e];
  const boundLo = mem8[FORMATION_X_BOUNDS];       // low bound
  const boundHi = mem8[FORMATION_X_BOUNDS + 1];   // high bound
  const low = word & 0xff;
  // The anchor is a signed 16-bit value; its sign is the top bit of the high byte.
  const negative = ((word >> 8) & 0x80) !== 0;   // sign lives in the high byte's top bit

  if (mem8[OBJ_SWEEP_DIRECTION] === 0) {
    // Ascending: turn around at the upper bound, else step up.
    // Reached the upper bound (non-negative and low byte past boundLo): flip to descending and stop.
    if (!negative && low >= boundLo) return setSweepDescending(m);
    // Throttle: only actually step on one frame in four; otherwise hold this frame.
    if (mem8[FRAME_COUNTER] & 0x03) return;            // 1-frame-in-4 throttle
    // Step the anchor up one unit.
    word = u16(word + 1);
  } else {
    // Descending: turn around at the lower bound, else step down.
    // Reached the lower bound (negative and low byte below boundHi): flip to ascending and stop.
    if (negative && low < boundHi) return setSweepAscending(m);
    // Same one-in-four throttle on the descending phase.
    if (mem8[FRAME_COUNTER] & 0x03) return;
    // Step the anchor down one unit.
    word = u16(word - 1);
  }

  // Commit the stepped anchor and push its negated low byte out across the strided coordinate lane so
  // every alien's Y follows the sway on the hardware.
  mem16[loc_420e] = word;
  return broadcastNegatedSweepToStridedTable(m, word & 0xff);
}

// Proximity gate: true when the behavior gate loc_4208 is armed, the shot position loc_4209 lies in a
// narrow window, and the column the anchor currently names reads occupied -- i.e. an armed shot is
// aligned on a live column of the block, so the sway should freeze that column for this frame.
function proximityGateHit(mem8) {
  // Not armed: gate off.
  if (!(mem8[loc_4208] & 0x01)) return false;
  // Shot position outside the 0x50-wide window starting at 0x22 ([0x22,0x72)): gate off.
  if (((mem8[loc_4209] - 0x22) & 0xff) >= 0x50) return false;
  // Fine alignment of the shot reference loc_420a against the anchor low byte: must land within the
  // low nibble's tight window (the +2 recenters it) or the gate is off.
  const delta = (mem8[loc_420a] - mem8[loc_420e]) & 0xff;
  if (((delta + 2) & 0x0f) >= 3) return false;
  // The high nibble of the aligned delta selects which formation column the shot is over.
  const column = (delta >> 4) & 0x0f;
  // Gate fires only if that column is actually occupied (COLUMN_OCCUPANCY bit 0 set).
  return (mem8[COLUMN_OCCUPANCY + column] & 0x01) !== 0;
}
