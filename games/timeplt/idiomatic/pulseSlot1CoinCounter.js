// SPDX-License-Identifier: GPL-3.0-only
/** pulseSlot1CoinCounter — drive one pulse of the mechanical counter for each coin the machine still owes, one
 * pulse at a time. With nothing owed it does nothing at all. Otherwise a frame timer runs the
 * pulse: idle, it is loaded to its full length and the counter line is driven high; running, it
 * drops by one a frame, the line is driven low again exactly at the half-way count, and on the
 * frame it reaches zero the debt drops by one instead — so the next owed pulse starts on the
 * frame after, and a debt of two comes out as two separate pulses rather than one long one.
 * The line is a latch, not memory, so nothing here reads back what it wrote.
 * LIVE-OUT: memory, plus the latched line. */

import { COIN_ACCEPTED, COIN_PULSE_TIMER, COIN_COUNTER_0_LATCH } from "./names.js";

const PULSE_FRAMES = 48;
const LINE_DROPS_AT = 24;
const WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE = 10;

const drive = (m, level) =>
  m.mem.write8(COIN_COUNTER_0_LATCH, level, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);

export function pulseSlot1CoinCounter(m) {
  const { mem8 } = m;
  if (mem8[COIN_ACCEPTED] === 0) return;

  const remaining = mem8[COIN_PULSE_TIMER];
  if (remaining === 0) {
    mem8[COIN_PULSE_TIMER] = PULSE_FRAMES;
    drive(m, 1);
    return;
  }

  const left = remaining - 1;
  mem8[COIN_PULSE_TIMER] = left;
  if (left === 0) {
    mem8[COIN_ACCEPTED] = mem8[COIN_ACCEPTED] - 1;
    return;
  }
  if (left === LINE_DROPS_AT) drive(m, 0);
}
