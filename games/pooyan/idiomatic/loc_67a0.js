// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006 } from "./loc_4006.js";
import { SHARED_FRAME_DELAY_TIMER } from "./names.js";
/**
 * loc_67a0 — per-object frame update, gated by the shared frame-delay timer.
 *
 * While the shared delay timer is non-zero it just decrements and returns. On expiry it steps the
 * object's animation via the sequencer, then moves two 16-bit positions down by the +0x09 speed: if the
 * record links another (its +0x07/+0x08 pointer has a non-zero high byte) that record's +0x05/+0x06
 * pair is decremented too, and always the object's own +0x05/+0x06 pair. When the own +0x06 high
 * byte reaches zero the object's state (+0x02) advances.
 *
 * LIVE-OUT: memory only — a per-frame state handler; callers do not read its leftover registers.
 */
export function loc_67a0(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[SHARED_FRAME_DELAY_TIMER] !== 0) {
    mem8[SHARED_FRAME_DELAY_TIMER] = mem8[SHARED_FRAME_DELAY_TIMER] - 1;
    return;
  }
  loc_4006(m, rec);

  const step = mem8[rec + 0x09];
  const linkHi = mem8[rec + 0x08];
  if (linkHi !== 0) {
    const link = (linkHi << 8) | mem8[rec + 0x07];
    const lo = mem8[link + 0x05] - step;
    if (lo < 0) mem8[link + 0x06] = mem8[link + 0x06] - 1; // 16-bit borrow into the high byte
    mem8[link + 0x05] = lo;
  }

  const own = mem8[rec + 0x05] - step;
  if (own < 0) mem8[rec + 0x06] = mem8[rec + 0x06] - 1; // 16-bit borrow into the high byte
  mem8[rec + 0x05] = own;

  if (mem8[rec + 0x06] !== 0) return;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // high byte hit zero: advance the object state
}
