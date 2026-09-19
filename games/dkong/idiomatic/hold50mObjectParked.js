// SPDX-License-Identifier: GPL-3.0-only
/**
 * hold50mObjectParked — the PARKED arm of the 50m board-object state machine: hold the object
 * still while its dwell timer (+1) runs down, advance its state (+0) when the timer elapses, and
 * stamp a shared flag while Mario is standing on the object's column (+2). The record base arrives
 * on the stack; on a hit-test miss the shared caller-skip unwinds two levels, skipping the stamp.
 *
 * LIVE-OUT: memory-only — the record's timer byte, its state byte on the elapsed branch, and the
 * shared flag.
 */

import { marioReachedTargetColumn as loc_2243 } from "./marioReachedTargetColumn.js";
import { loc_621a } from "./names.js";

export function hold50mObjectParked(m) {
  const { mem8 } = m;

  const base = m.pop16();

  const timer = (mem8[base + 1] - 1) & 0xff;
  mem8[base + 1] = timer;

  if (timer === 0) {
    mem8[base] = mem8[base] + 1;
    if (!loc_2243(m, base + 2)) return;
    mem8[loc_621a] = 1;
    return;
  }

  if (!loc_2243(m, base + 2)) return;
  mem8[loc_621a] = 0;
}
