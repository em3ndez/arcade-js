// SPDX-License-Identifier: GPL-3.0-only
/** multiplexSpriteSlotsSkipping — scanline-gated position fixup over eight sprite slots. Each slot pairs a Y byte in
 * one sprite bank with the X byte at the matching offset in the other. A slot acts only while its Y
 * byte has bit 7 set and adding the live scanline counter to it carries out of the top; on that
 * trigger the Y byte's bit 7 is cleared, quieting the slot, and the X byte's bit 7 is toggled.
 * LIVE-OUT: the touched sprite bytes, plus the accumulator, C and flags left by the last slot. */

const SCANLINE_COUNTER = 0xc000;
const DISARM_MASK = 0x7f;
const TOGGLE_X_BIT7 = 0x80;

// [Y byte, X byte] for each of the eight slots this pass covers.
const SLOTS = [
  [0xb411, 0xb010],
  [0xb413, 0xb012],
  [0xb415, 0xb014],
  [0xb437, 0xb036],
  [0xb439, 0xb038],
  [0xb43b, 0xb03a],
  [0xb43d, 0xb03c],
  [0xb43f, 0xb03e],
];

function serviceSlot(m, yAddr, xAddr) {
  const { regs, mem } = m;
  regs.a = mem.read8(yAddr);
  regs.bit(7, regs.a);
  if (regs.fZ) return;
  regs.c = regs.a;
  regs.a = mem.read8(SCANLINE_COUNTER);
  regs.add(regs.c);
  if (regs.fNC) return; // beam not past the trigger line yet
  regs.a = regs.c;
  regs.and(DISARM_MASK);
  mem.write8(yAddr, regs.a);
  regs.a = mem.read8(xAddr);
  regs.add(TOGGLE_X_BIT7);
  mem.write8(xAddr, regs.a);
}

export function multiplexSpriteSlotsSkipping(m) {
  for (const [yAddr, xAddr] of SLOTS) serviceSlot(m, yAddr, xAddr);
  return m.ret();
}
