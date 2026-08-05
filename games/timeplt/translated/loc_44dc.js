// SPDX-License-Identifier: GPL-3.0-only

// loc_44dc  (ROM 0x44DC–0x44F0)
export function loc_44dc(m) {
  const { regs, mem } = m;

  regs.de = 0x0202;
  m.step(0x44df, 10); // ld de,0x0202
  regs.hl = 0xd4d5;
  m.step(0x44e2, 10); // ld hl,0xd4d5 -- H and L are two separate sprite bytes
  regs.a = mem.read8(0xa980);
  m.step(0x44e5, 13); // ld a,(0xa980)
  regs.bit(2, regs.a);
  m.step(0x44e7, 8); // bit 2,a

  if (regs.fNZ) {
    m.step(0x44ea, 12); // jr nz,0x44ea taken -- keep 0xD5/0xD4
  } else {
    m.step(0x44e9, 7); // jr nz not taken
    regs.addHl(regs.de);
    m.step(0x44ea, 11); // add hl,de -- 0xD7/0xD6, the other animation frame
  }

  mem.write8((regs.iy + 0x01) & 0xffff, regs.l);
  m.step(0x44ed, 19); // ld (iy+0x01),l
  mem.write8((regs.iy + 0x03) & 0xffff, regs.h);
  m.step(0x44f0, 19); // ld (iy+0x03),h

  m.ret(); // 44f0
}
