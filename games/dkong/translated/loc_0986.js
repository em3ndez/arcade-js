// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0986  (ROM 0x0986–0x09AA).
 */
export function loc_0986(m) {
  const { regs, mem } = m;

  m.push16(0x0989);
  m.step(0x0852, 17); // call 0x0852
  m.call(0x0852);
  m.push16(0x098c);
  m.step(0x011c, 17); // call 0x011c
  m.call(0x011c);

  regs.de = 0x7d82;
  m.step(0x098f, 10); // ld de,0x7d82
  regs.a = 0x01;
  m.step(0x0991, 7); // ld a,0x01
  mem.write8(regs.de, regs.a, 7); // ld (de),a -- 0x7D82 = 1 (flipscreen)
  m.step(0x0992, 7);
  regs.hl = 0x600a;
  m.step(0x0995, 10); // ld hl,0x600a
  regs.a = mem.read8(0x600e);
  m.step(0x0998, 13); // ld a,(0x600e)
  regs.and(regs.a); // Z iff 0x600E == 0
  m.step(0x0999, 4);

  if (regs.fZ) {
    m.step(0x099c, 10); // jp nz NOT taken
    mem.write8(regs.hl, 0x01); // 0x600A = 1
    m.step(0x099e, 10);
    m.ret();
    return;
  }
  m.step(0x099f, 10); // jp nz,0x099f

  regs.a = mem.read8(0x6026);
  m.step(0x09a2, 13); // ld a,(0x6026)
  regs.a = regs.dec8(regs.a);
  m.step(0x09a3, 4); // dec a
  if (regs.fZ) {
    m.step(0x09a8, 10); // jp z,0x09a8 -- 0x6026 == 1, keep 0x7D82 = 1
  } else {
    m.step(0x09a6, 10); // jp z NOT taken
    regs.xor(regs.a); // A = 0
    m.step(0x09a7, 4);
    mem.write8(regs.de, regs.a, 7); // 0x7D82 = 0 -- DE still 0x7D82
    m.step(0x09a8, 7);
  }
  mem.write8(regs.hl, 0x03); // 0x600A = 3
  m.step(0x09aa, 10);
  m.ret(); // ret (0x09AA)
}
