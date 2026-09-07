// SPDX-License-Identifier: GPL-3.0-only
/**
 * expireActivityGatedTimer -- a countdown that only advances while the field is busy.
 *
 * WHAT IT IS
 *   One of the background timers the vblank service layers over play. It ticks a counter down each frame,
 *   but ONLY while it is armed AND at least one "activity gate" is open, and disarms itself when the
 *   counter reaches zero. Because it pauses whenever the field goes quiet, it measures active play rather
 *   than wall-clock frames -- it ends an activity-gated timed phase only after enough busy frames.
 *
 * ROLE IN THE MACHINE
 *   The arm flag is loc_422b (0x422b) bit 0; the counter is loc_422c (0x422c). The activity gates are
 *   three occupancy/near-empty signals: loc_4224 (0x4224, the near-empty flag set by
 *   driveSoundVoicesFromOccupancy), loc_4221 (0x4221), and loc_4226 (0x4226) bit 0. Any one of them being
 *   set counts as "the field is active". When none is set the timer holds -- it neither ticks nor disarms.
 *
 * ROM 0x1688.  Grounding: [seen]. Cells: arm flag loc_422b (0x422b bit0), counter loc_422c (0x422c),
 * activity gates loc_4224 (0x4224), loc_4221 (0x4221), loc_4226 (0x4226 bit0).
 *
 * LIVE-OUT: mem8 -- loc_422c decremented (on a busy armed frame) and loc_422b cleared once it hits zero.
 * No register result.
 */
import { loc_4221, loc_4224, loc_4226, loc_422b, loc_422c } from "./names.js";

export function expireActivityGatedTimer(m) {
  const { mem8 } = m;

  // Not armed (0x422b bit0 clear) -> nothing to do this frame.
  if ((mem8[loc_422b] & 1) === 0) return;

  // Hold unless at least one activity gate is open: two whole-byte flags (0x4224, 0x4221) and one bit-0
  // flag (0x4226). While the field is quiet the timer neither ticks nor disarms.
  const active = mem8[loc_4224] !== 0 || mem8[loc_4221] !== 0 || (mem8[loc_4226] & 1) !== 0;
  if (!active) return;

  // Tick the counter down one (byte-wrapping), and disarm the flag once the countdown reaches zero --
  // ending the activity-gated phase.
  const remaining = (mem8[loc_422c] - 1) & 0xff;
  mem8[loc_422c] = remaining;
  if (remaining === 0) mem8[loc_422b] = 0;
}
