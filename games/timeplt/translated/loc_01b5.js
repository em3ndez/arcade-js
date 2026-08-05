// SPDX-License-Identifier: GPL-3.0-only

// loc_01b5  (ROM 0x01B5–0x01C1)
export function loc_01b5(m) {
  const { regs, mem } = m;

  regs.hl = 0xa404;
  m.step(0x01b8, 10); // ld hl,0xa404
  mem.write16(0xa989, regs.hl);
  m.step(0x01bb, 16); // ld (0xa989),hl
  regs.a = mem.read8(0x0ccd); // ROM constant
  m.step(0x01be, 13); // ld a,(0x0ccd)
  mem.write8(0xa988, regs.a);
  m.step(0x01c1, 13); // ld (0xa988),a

  m.ret(10); // ret (0x01C1)
}
