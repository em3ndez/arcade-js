// SPDX-License-Identifier: GPL-3.0-only
/** loc_5254 — close one shot's pass over the target run and open the next shot's.
 *
 * The two target cursors are restaged from the pair of cells that hold them, so every shot walks
 * the same run from its head; the per-pass target count comes from the shadow accumulator rather
 * than from whatever the pass just consumed; and the shot cursor steps one record on WITHOUT
 * leaving its page, the carry being dropped. With shots still owed a pass the sweep runs again
 * for the rest of them, and with none left this does nothing further. LIVE-OUT: memory-only. */

import { u8 } from "../../../core/int.js";
import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";

const TARGET_ENTRY_CURSOR = 0xa991;
const TARGET_RECORD_CURSOR = 0xa993;
const RECORD_STRIDE = 16;

export function loc_5254(
  m,
  shot = m.regs.ix,
  shots = m.regs.c,
  targetsPerPass = m.regs.a_,
  reach = m.regs.l,
  span = m.regs.h,
) {
  const { mem16 } = m;
  const shotsLeft = u8(shots - 1);
  if (shotsLeft === 0) return;
  const nextShot = (shot & 0xff00) | u8(shot + RECORD_STRIDE);
  destroyTargetsHitByShots(
    m,
    nextShot,
    mem16[TARGET_ENTRY_CURSOR],
    mem16[TARGET_RECORD_CURSOR],
    targetsPerPass,
    targetsPerPass,
    shotsLeft,
    reach,
    span,
  );
}
