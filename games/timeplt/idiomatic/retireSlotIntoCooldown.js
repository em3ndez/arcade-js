// SPDX-License-Identifier: GPL-3.0-only
/** retireSlotIntoCooldown — retire a slot and put it straight on a delay. The record's occupancy byte and both
 * of the sprite entry's coordinate bytes go to zero, which is the whole of taking the object out
 * of play; a further record byte is then loaded with a count, so the slot is not free the instant
 * it is emptied. Both bases are parameters, so WHICH slot goes out is the caller's.
 * LIVE-OUT: memory only — four bytes. */

const OCCUPANCY = 0;
const DELAY = 0x0e;
const SECOND_AXIS_OFFSET = 0x31;
const DELAY_FRAMES = 0xf0;

export function retireSlotIntoCooldown(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  mem8[record + OCCUPANCY] = 0;
  mem8[entry] = 0;
  mem8[entry + SECOND_AXIS_OFFSET] = 0;
  mem8[record + DELAY] = DELAY_FRAMES;
}
