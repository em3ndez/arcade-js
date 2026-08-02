// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2118  (ROM 0x2118–0x215C) — object velocity/sprite state setup -> shared tail.
 */
export function loc_2118(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(R(0x05));
  m.step(0x211b, 19); // ld a,(ix+0x05)
  regs.cp(0xe0);
  m.step(0x211d, 7); // cp 0xe0
  if (regs.fC) { m.step(0x2146, 10); return m.call(0x2146); } // jp c
  m.step(0x2120, 10);
  regs.a = mem.read8(R(0x07));
  m.step(0x2123, 19); // ld a,(ix+0x07)
  regs.and(0xfc);
  m.step(0x2125, 7); // and 0xfc
  regs.or(0x01);
  m.step(0x2127, 7); // or 0x01
  mem.write8(R(0x07), regs.a);
  m.step(0x212a, 19); // ld (ix+0x07),a
  regs.xor(regs.a); // A = 0
  m.step(0x212b, 4); // xor a
  mem.write8(R(0x01), regs.a);
  m.step(0x212e, 19); // ld (ix+0x01),a
  mem.write8(R(0x02), regs.a);
  m.step(0x2131, 19); // ld (ix+0x02),a
  mem.write8(R(0x10), 0xff);
  m.step(0x2135, 19); // ld (ix+0x10),0xff
  mem.write8(R(0x11), regs.a);
  m.step(0x2138, 19); // ld (ix+0x11),a
  mem.write8(R(0x12), regs.a);
  m.step(0x213b, 19); // ld (ix+0x12),a
  mem.write8(R(0x13), 0xb0);
  m.step(0x213f, 19); // ld (ix+0x13),0xb0
  mem.write8(R(0x0e), 0x01);
  m.step(0x2143, 19); // ld (ix+0x0e),0x01
  m.step(0x2153, 10); // jp 0x2153
  return m.call(0x2153);
}
