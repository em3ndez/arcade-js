// SPDX-License-Identifier: GPL-3.0-only
import { OBJ_HIT_FLAG_I0, OBJ_HIT_FLAG_I1 } from "./names.js";
import { loc_0010 } from "./loc_0010.js";
import { queueSoundCommand01 } from "./queueSoundCommand01.js";
import { loc_2226 } from "./loc_2226.js";
/**
 * loc_21cf — per-object state step for the record based at IY.
 *
 * With bit0 of rec+7 set it runs the launch sub-phase: advance rec+4 by 4 (seeding rec+0x0f on
 * the first tick) until it reaches 0xe8, then clear the record. Otherwise it primes rec+0x12 once
 * (queueing a display command), and — unless bit1 of rec+0 diverts it to the two-axis mover —
 * consumes a per-object hit-timer cell or decrements rec+6 by 4, clearing the record when either
 * expires. Clearing blanks 0x18 bytes from IY.
 *
 * LIVE-OUT: memory only — the caller reads no register back.
 */
export function loc_21cf(m, rec = m.regs.iy) {
  const { mem8 } = m;

  const clearRecord = () => loc_0010(m, rec, 0x00, 0x18); // blank 0x18 bytes from the record base

  if (mem8[rec + 0x07] & 0x01) {
    const step = mem8[rec + 0x01];
    if (step < 0x01) return; // not yet armed
    if (step === 0x01) {
      mem8[rec + 0x0f] = 0x1b; // seed on the first tick
      mem8[rec + 0x01] = step + 1;
    }
    const y = (mem8[rec + 0x04] + 0x04) & 0xff;
    mem8[rec + 0x04] = y;
    if (y < 0xe8) return; // still travelling
    return clearRecord();
  }

  if (mem8[rec + 0x12] === 0) {
    mem8[rec + 0x12] = 1; // prime once
    queueSoundCommand01(m);
  }

  if (mem8[rec] & 0x02) return loc_2226(m, rec); // two-axis mover

  const timer = (rec & 0x08) ? OBJ_HIT_FLAG_I1 : OBJ_HIT_FLAG_I0;
  if (mem8[timer] !== 0) {
    mem8[timer] = 0x00; // consume the hit and clear
    return clearRecord();
  }

  if (mem8[rec + 0x06] < 0x04) return clearRecord(); // countdown underflow
  mem8[rec + 0x06] = mem8[rec + 0x06] - 0x04;
}
