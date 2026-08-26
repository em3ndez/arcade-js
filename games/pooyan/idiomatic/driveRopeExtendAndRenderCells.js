// SPDX-License-Identifier: GPL-3.0-only
import { GRAB_ACTIVE_FLAG, WAVE_ARRIVAL_COUNTER } from "./names.js";
import { dispatchRopeExtendState } from "./dispatchRopeExtendState.js";
import { driveActiveRopeCells } from "./driveActiveRopeCells.js";
/**
 * driveRopeExtendAndRenderCells — even-frame rope driver.
 *
 * Bails while a grab is in progress, or while the wave-arrival counter still sits at its hold
 * value; otherwise runs the two rope sub-drivers in order (tile driver then cell writer).
 *
 * LIVE-OUT: none — a per-frame driver run for its memory effects; the caller only sequences it.
 */
const ARRIVAL_HOLD = 0x02; // arrival-counter value that suppresses the driver

export function driveRopeExtendAndRenderCells(m) {
  const { mem8 } = m;

  if (mem8[GRAB_ACTIVE_FLAG] !== 0) return; // grab in progress
  if (mem8[WAVE_ARRIVAL_COUNTER] === ARRIVAL_HOLD) return;

  dispatchRopeExtendState(m);
  driveActiveRopeCells(m);
}
