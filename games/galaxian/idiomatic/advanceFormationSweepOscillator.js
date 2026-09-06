// SPDX-License-Identifier: GPL-3.0-only
// Oscillating formation mover: once every 4 frames, nudge the swept 16-bit word one step toward its
// bound pair, steered by the sweep-direction flag, flipping direction at each bound. A leading
// proximity gate (the shot lined up on the swept column) shortcuts straight to the formation broadcast.
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

  if (proximityGateHit(mem8)) return broadcastNegatedFormationSweepToStridedTable(m);

  let word = mem16[loc_420e];
  const boundLo = mem8[FORMATION_X_BOUNDS];       // low bound
  const boundHi = mem8[FORMATION_X_BOUNDS + 1];   // high bound
  const low = word & 0xff;
  const negative = ((word >> 8) & 0x80) !== 0;   // sign lives in the high byte's top bit

  if (mem8[OBJ_SWEEP_DIRECTION] === 0) {
    // Ascending: turn around at the upper bound, else step up.
    if (!negative && low >= boundLo) return setSweepDescending(m);
    if (mem8[FRAME_COUNTER] & 0x03) return;            // 1-frame-in-4 throttle
    word = u16(word + 1);
  } else {
    // Descending: turn around at the lower bound, else step down.
    if (negative && low < boundHi) return setSweepAscending(m);
    if (mem8[FRAME_COUNTER] & 0x03) return;
    word = u16(word - 1);
  }

  mem16[loc_420e] = word;
  return broadcastNegatedSweepToStridedTable(m, word & 0xff);
}

// True when the behavior gate is armed, the shot position lies in the narrow window aligned to the
// swept word, and the word's target column reads occupied.
function proximityGateHit(mem8) {
  if (!(mem8[loc_4208] & 0x01)) return false;
  if (((mem8[loc_4209] - 0x22) & 0xff) >= 0x50) return false;
  const delta = (mem8[loc_420a] - mem8[loc_420e]) & 0xff;
  if (((delta + 2) & 0x0f) >= 3) return false;
  const column = (delta >> 4) & 0x0f;
  return (mem8[COLUMN_OCCUPANCY + column] & 0x01) !== 0;
}
