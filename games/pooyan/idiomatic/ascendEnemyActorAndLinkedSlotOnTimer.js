// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { SHARED_FRAME_DELAY_TIMER } from "./names.js";
/**
 * ascendEnemyActorAndLinkedSlotOnTimer — one enemy-actor object's per-frame update, ROM 0x67a0-0x67de. [seen]
 *
 * WHAT IT IS
 *   The state handler for an enemy actor that is sliding along its ascent track. Each object in the
 *   stride-0x18 actor arena carries a 16-bit fixed-point sub-position; this handler steps that
 *   position by the object's speed once per elapsed tick, animates its sprite, and hands the object
 *   off to its next phase when the slide completes.
 *
 * ITS ROLE IN THE MACHINE
 *   Enemies do not move a whole pixel every frame — they inch along a fixed-point sub-position and
 *   only advance to the next behaviour phase once that position winds down to its limit. The pacing
 *   is deliberately coarse: the whole object update is held off by SHARED_FRAME_DELAY_TIMER, a single
 *   counter that several object sweeps consult so the motion runs at a divided rate rather than every
 *   frame. When an enemy is coupled to a second object (an enemy and the slot it rides together), the
 *   partner's position is dragged by the same speed so the pair stays locked as one moving unit.
 *
 * THE RECORD (base = rec)
 *   +0x02  object state byte — selects which per-frame handler runs; bumped here to advance the phase.
 *   +0x05  low byte of the 16-bit sub-position.
 *   +0x06  high byte of the 16-bit sub-position; when it winds down to zero the slide is finished.
 *   +0x07  low byte of the linked record's address.
 *   +0x08  high byte of the linked record's address; zero means "no partner".
 *   +0x09  per-tick speed: how far the sub-position is stepped each elapsed tick.
 *
 * LIVE-OUT: memory only — a per-frame state handler; callers do not read its leftover registers.
 */
export function ascendEnemyActorAndLinkedSlotOnTimer(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Rate gate. SHARED_FRAME_DELAY_TIMER (0x8929) throttles this and the sibling object sweeps: while
  // it is still counting, no motion happens — just spend one tick of the delay and return. The object
  // only actually moves on the frame the timer reads zero.
  if (mem8[SHARED_FRAME_DELAY_TIMER] !== 0) {
    mem8[SHARED_FRAME_DELAY_TIMER] = mem8[SHARED_FRAME_DELAY_TIMER] - 1;
    return;
  }
  // Timer expired: step this object's sprite animation one entry along its script.
  advanceObjectAnimationFrame(m, rec);

  // Speed for this tick (rec+0x09), and the high byte of the linked-record pointer (rec+0x08).
  const step = mem8[rec + 0x09];
  const linkHi = mem8[rec + 0x08];
  // Drag the partner. A non-zero pointer high byte means this object is coupled to a second record;
  // rebuild that record's address from its high/low bytes (rec+0x08 : rec+0x07) and slide the
  // partner's own 16-bit sub-position (+0x05 : +0x06) down by the same speed so the pair moves as one.
  if (linkHi !== 0) {
    const link = (linkHi << 8) | mem8[rec + 0x07];
    const lo = mem8[link + 0x05] - step;
    if (lo < 0) mem8[link + 0x06] = mem8[link + 0x06] - 1; // 16-bit borrow into the high byte
    mem8[link + 0x05] = lo;
  }

  // Move this object. Subtract the speed from its own 16-bit sub-position (rec+0x05 : rec+0x06);
  // when the low byte underflows, borrow one from the high byte, exactly as a 16-bit subtraction.
  const own = mem8[rec + 0x05] - step;
  if (own < 0) mem8[rec + 0x06] = mem8[rec + 0x06] - 1; // 16-bit borrow into the high byte
  mem8[rec + 0x05] = own;

  // Slide still in progress? While the high byte (rec+0x06) is non-zero the object has more track to
  // cover, so leave the state byte alone and come back next elapsed tick.
  if (mem8[rec + 0x06] !== 0) return;
  // Track exhausted: the high byte reached zero, so advance the object's state byte (rec+0x02) to
  // hand this record to its next behaviour phase.
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // high byte hit zero: advance the object state
}
