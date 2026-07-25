// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0486  (ROM 0x0486–0x049E) — colour tail (reached 7 ways): C=frame counter; (6227)==4 -> loc_04be blink block.
 */
export function loc_0486(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6390);
  m.step(0x0489, 13); // ld a,(0x6390)
  regs.c = regs.a;
  m.step(0x048a, 4); // ld c,a -- C = frame counter
  regs.de = 0x0020;
  m.step(0x048d, 10); // ld de,0x0020 (stride for sub_0514)
  regs.a = mem.read8(0x6227);
  m.step(0x0490, 13); // ld a,(0x6227)
  regs.cp(0x04);
  m.step(0x0492, 7); // cp 0x04
  if (regs.fZ) { m.step(0x04be, 10); return m.call(0x04be); } // jp z,0x04be
  m.step(0x0495, 10); // (6227)!=4
  regs.a = regs.c;
  m.step(0x0496, 4); // ld a,c
  regs.and(regs.a);
  m.step(0x0497, 4); // and a
  if (regs.fZ) { m.step(0x04a1, 10); return m.call(0x04a1); } // jp z,0x04a1
  m.step(0x049a, 10); // counter != 0
  regs.a = 0xef;
  m.step(0x049c, 7); // ld a,0xef
  const b6 = regs.bit(6, regs.c);
  m.step(0x049e, 8); // bit 6,c
  if (b6) { m.step(0x04a3, 10); return m.call(0x04a3); } // jp nz,0x04a3 (A stays 0xef)
  m.step(0x04a1, 10); // bit6==0 -> fall to 0x04a1
  return m.call(0x04a1);
}
