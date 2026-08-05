// SPDX-License-Identifier: GPL-3.0-only

// loc_46ba  (ROM 0x46BA-0x46C3)
export function loc_46ba(m) {
  const { regs, mem } = m;

  regs.hl = 0x46ce;
  m.step(0x46bd, 10); // ld hl,0x46ce
  m.push16(regs.hl);
  m.step(0x46be, 11); // push hl -- the arm's ret lands on 0x46CE
  regs.a = mem.read8(0xad04);
  m.step(0x46c1, 13); // ld a,(0xad04)
  regs.and(0x07);
  m.step(0x46c3, 7); // and 0x07 -- A is the table index

  m.push16(0x46c4); // rst 0x30 pushes the address AFTER it -- the table base
  m.step(0x0030, 11); // rst 0x30
  m.call(0x0030, "0x46c4 ((0xad04) stage)"); // inline jump table dispatch

  return m.call(0x46ce);
}
