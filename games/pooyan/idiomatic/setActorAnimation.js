// SPDX-License-Identifier: GPL-3.0-only
/**
 * setActorAnimation — point an actor record at an animation sequence and restart it.
 * Stores the little-endian pointer into the record's 16-bit anim field (rec+0x0C/0x0D)
 * and resets the frame index at rec+0x0E to 0. A leaf: writes three bytes, reads nothing.
 *
 * LIVE-OUT: memory only — rec+0x0C..rec+0x0E.
 */
export function setActorAnimation(m, rec = m.regs.ix, animPointer = m.regs.de) {
  const { mem8 } = m;

  const base = rec;
  mem8[base + 0x0c] = animPointer; // sequence pointer, low byte
  mem8[base + 0x0d] = animPointer >> 8; // sequence pointer, high byte
  mem8[base + 0x0e] = 0x00; // frame index -> 0
}
