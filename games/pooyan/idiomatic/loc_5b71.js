// SPDX-License-Identifier: GPL-3.0-only
import { launchProjectileIntoFreeSlot } from "./launchProjectileIntoFreeSlot.js";
/**
 * loc_5b71 — fire gate for one actor record (based at IX). Launches only when the record is in
 * mode 5 (rec+2), its fire flag is set (bit 2 of rec+7) and its timer (rec+6) is still inside the
 * launch window (below 0x11); any guard failing returns without acting.
 *
 * LIVE-OUT: memory only — the per-record scan that calls this reads no register back.
 */

const FIRE_MODE = 0x05;
const FIRE_FLAG = 0x04;
const TIMER_LIMIT = 0x11;

export function loc_5b71(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[rec + 0x02] !== FIRE_MODE) return; // not mode 5
  if ((mem8[rec + 0x07] & FIRE_FLAG) === 0) return; // fire flag clear
  if (mem8[rec + 0x06] >= TIMER_LIMIT) return; // timer past the launch window

  launchProjectileIntoFreeSlot(m, rec); // all guards pass — launch this record (threaded, not via a stale IX bridge)
}
