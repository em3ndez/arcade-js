// SPDX-License-Identifier: GPL-3.0-only

// loc_02e6  (ROM 0x02e6-0x02ee) -- stores HL into the pointer (0x880b) and seeds
// the counter (0x8809) to 0x20; paired with loc_02ce which walks them down.
export function loc_02e6(m) {
  const { regs, mem } = m;

  mem.write16(0x880b, regs.hl);
  m.step(0x02e9, 16); // ld (0x880b),hl
  regs.a = 0x20;
  m.step(0x02eb, 7);
  mem.write8(0x8809, regs.a);
  m.step(0x02ee, 13); // ld (0x8809),a

  return m.ret(); // ret (10 T)
}
