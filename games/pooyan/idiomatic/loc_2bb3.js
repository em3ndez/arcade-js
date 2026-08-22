// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2be5 } from "./loc_2be5.js";
/**
 * loc_2bb3 — formation spawn scan: walk up to 0x11 records, stepping the pointer by `stride`
 * each pass, trying to launch one via the per-slot launcher, which returns false the moment it
 * launches a free slot, aborting the scan (a caller-skip, here an early return); a busy slot
 * returns true and the walk continues until all records are seen.
 *
 * Entered by fallthrough from the formation driver and by a sibling jump entry; both seat the
 * pointer and stride in registers, so the defaults bridge them. LIVE-OUT: memory only.
 */

const SLOT_COUNT = 0x11; // records scanned per formation pass

export function loc_2bb3(m, rec = m.regs.ix, stride = m.regs.de) {
  let cursor = rec;
  for (let remaining = SLOT_COUNT; remaining > 0; remaining--) {
    if (!loc_2be5(m, cursor)) return; // slot launched -> abort the scan
    cursor = u16(cursor + stride);
  }
}
