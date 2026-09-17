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

const OBJECT_FLAG = 0x621a; // shared object flag; several unrelated writers, so it stays local

export function hold50mObjectParked(m) {
  const { regs, mem8 } = m;

  const base = m.pop16();

  const timer = (mem8[base + 1] - 1) & 0xff;
  mem8[base + 1] = timer;

  if (timer === 0) {
    mem8[base] = mem8[base] + 1;
    regs.hl = base + 2;
    if (!loc_2243(m)) return;
    mem8[OBJECT_FLAG] = 1;
    return;
  }

  regs.hl = base + 2;
  if (!loc_2243(m)) return;
  mem8[OBJECT_FLAG] = 0;
}
