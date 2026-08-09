// SPDX-License-Identifier: GPL-3.0-only
/** loc_3ff9 — sweep a fixed bank of object slots for a frame, servicing each occupied one. An empty
 * head (0) is left alone, a ballistic head (0xFF) is flown a frame along its arc, any other value is
 * a live countdown the shape-cycle service runs down; the cursor strides one record and two
 * sprite-entry bytes per slot, for the caller's count. LIVE-OUT: memory. */

import { flyAlongBallisticArc } from "./flyAlongBallisticArc.js";
import { runOneShotAnimatedObjectSlot } from "./runOneShotAnimatedObjectSlot.js";

const RECORD_STRIDE = 0x10;
const ENTRY_STRIDE = 2;
const BALLISTIC = 0xff;

export function loc_3ff9(m) {
  const { regs, mem8 } = m;
  let record = regs.ix;
  let entry = regs.iy;
  let count = regs.b;

  for (;;) {
    // Re-seat the cursor each turn; the services read it off ix/iy and need not hand it back.
    regs.ix = record;
    regs.iy = entry;
    const head = mem8[record];
    if (head === BALLISTIC) flyAlongBallisticArc(m);
    else if (head !== 0) runOneShotAnimatedObjectSlot(m);

    record = (record + RECORD_STRIDE) & 0xffff;
    entry = (entry + ENTRY_STRIDE) & 0xffff;
    count = (count - 1) & 0xff;
    if (count === 0) break;
  }

  regs.ix = record;
  regs.iy = entry;
}
