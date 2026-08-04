// SPDX-License-Identifier: GPL-3.0-only
/**
 * hold50mObjectParked — the PARKED arm of the 50m board-object state machine: hold the object
 * still while its dwell timer runs down, advance its state when the timer elapses, and stamp a
 * shared flag while Mario is standing on the object's column.
 *
 * The object is an 8-byte record whose base arrives on the stack, and this is the arm taken while
 * its state byte is 0. Nothing moves in this state — the object's position counter is not touched
 * anywhere here, which is what "parked" means. Three of the record's bytes matter:
 *   +0  the object's state, advanced by one when the dwell timer elapses
 *   +1  the dwell timer, counted down one step every time this arm runs
 *   +2  the object's column — the X Mario has to be standing on
 *
 * What it does:
 *   1. Count the dwell timer down by one, on every pass without exception.
 *   2. If the timer just reached zero: advance the object's state — which is what sets the object
 *      moving — and then hit-test Mario against the object's column. On a hit, stamp the shared
 *      flag with 1: he was on the column on the very frame the dwell expired.
 *   3. If the timer is still running: run the same hit test, and on a hit stamp the flag with 0.
 *   4. On a MISS the hit test unwinds two levels rather than returning here, so the flag stamp is
 *      skipped entirely. The timer has already been counted down and, on the elapsed branch, the
 *      state has already been advanced — a miss suppresses only the stamp.
 *
 * WHAT THIS NAME DOES NOT CLAIM: WHICH 50m object the record drives, or whether its travel is an
 * extension or a retraction. The flag half of the behaviour is described here but deliberately
 * left out of the name, because what reads that flag has not been established.
 *
 * The record base arrives on the stack and the hit test takes its target through a pointer
 * register, so both are set up immediately before use rather than passed as arguments.
 *
 * LIVE-OUT: memory-only — the record's timer byte, its state byte on the elapsed branch, and the
 * shared flag.
 */

import { marioReachedTargetColumn as loc_2243 } from "./marioReachedTargetColumn.js";

const OBJECT_FLAG = 0x621a; // a shared object flag; several unrelated writers, so it stays local

export function hold50mObjectParked(m) {
  const { regs, mem } = m;

  // The record base was pushed for this pop — receive it here.
  const base = m.pop16();

  // Count this object's dwell timer (+1) down by one, every pass.
  const timer = (mem.read8(base + 1) - 1) & 0xff;
  mem.write8(base + 1, timer);

  if (timer === 0) {
    // Dwell elapsed: advance the object's state (+0) — starting it moving — before the test.
    mem.write8(base, mem.read8(base) + 1);

    // Is Mario standing on this object's column (+2)? On a miss the shared caller-skip
    // unwinds two levels, so the flag stamp below is skipped.
    regs.hl = base + 2;
    if (!loc_2243(m)) return;

    // On the column on the frame the dwell expired.
    mem.write8(OBJECT_FLAG, 1);
    return;
  }

  // Timer still running: same hit test against the object's column (+2).
  regs.hl = base + 2;
  if (!loc_2243(m)) return;

  // On the column while the dwell was still running.
  mem.write8(OBJECT_FLAG, 0);
}
