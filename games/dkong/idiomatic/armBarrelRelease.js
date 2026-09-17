// SPDX-License-Identifier: GPL-3.0-only
/**
 * armBarrelRelease — one entry of the bonus-event slot-claim cluster: stash the caller's mode byte,
 * then, when the bonus counter has reached its scheduled mark, step the mark and claim a free object
 * slot.
 *
 * The two scratch writes happen on every entry. The periodic-event gate then proceeds only when the
 * mark equals the bonus passed in; on a hit it steps the mark down by 8 and scans OBJ_ARRAY_64's
 * five records for the first with a zero active byte, raising the barrel-kind bit on the claim mode
 * byte. Unlike the cluster's other entries, this one does not stamp that byte up front.
 *
 * LIVE-OUT: memory-only — the two scratch bytes, the event mark, and (on a slot claim only) the
 * barrel-claim mode byte.
 */

import { BONUS_EVENT_MARK, OBJ_ARRAY_64 } from "./names.js";
import { markNextBarrelAsAltKind } from "./markNextBarrelAsAltKind.js";

const SCRATCH_MODE = 0x638f;
const SCRATCH_FLAG = 0x6392;
const RECORDS = 5;
const STRIDE = 32;
const EVENT_STEP = 8;

/**
 * @param {number} scratchValue  the caller's mode byte, stashed into engine scratch.
 * @param {number} bonus         the current bonus value the event mark is tested against.
 */
export function armBarrelRelease(m, scratchValue, bonus) {
  const { mem8 } = m;

  mem8[SCRATCH_MODE] = scratchValue;
  mem8[SCRATCH_FLAG] = 1;

  const mark = mem8[BONUS_EVENT_MARK];
  if (mark !== bonus) return;

  mem8[BONUS_EVENT_MARK] = mark - EVENT_STEP;

  // Claim the first free (zero active-byte) slot.
  for (let i = 0; i < RECORDS; i++) {
    if (mem8[OBJ_ARRAY_64 + i * STRIDE] === 0) {
      markNextBarrelAsAltKind(m);
      return;
    }
  }
}
