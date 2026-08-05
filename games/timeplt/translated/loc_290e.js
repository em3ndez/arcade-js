// SPDX-License-Identifier: GPL-3.0-only

// loc_290e  (ROM 0x290E-0x2913)
export function loc_290e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x2911, 13); // ld a,(0xad04)
  regs.and(0x07);
  m.step(0x2913, 7); // and 0x07 -- A is the table index

  m.push16(0x2914); // rst 0x30 pushes the address AFTER it -- the table base
  m.step(0x0030, 11); // rst 0x30
  return m.call(0x0030, "0x2914 ((0xad04) stage)"); // inline jump table dispatch
}
