// SPDX-License-Identifier: GPL-3.0-only

// loc_15c2  (ROM 0x15C2-0x15C7)
export function loc_15c2(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9ac);
  m.step(0x15c5, 13); // ld a,(0xa9ac)
  regs.and(0x07);
  m.step(0x15c7, 7); // and 0x07 -- the table index

  m.push16(0x15c8); // rst 0x30 pushes the address AFTER it -- the table base
  m.step(0x0030, 11); // rst 0x30
  return m.call(0x0030, "0x15c8 ((0xa9ac)&7 NMI sub-state)"); // TAIL -- inline dispatch
}
