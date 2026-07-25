// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1cd2  (ROM 0x1CD2–0x1CF1) — apply movement (0x6203 += B, signed); 0x6227 clamp.
 */
export function loc_1cd2(m) {
  const { regs, mem } = m;
  regs.hl = 0x6203; // player X
  m.step(0x1cd5, 10); // ld hl,0x6203
  regs.a = mem.read8(regs.hl);
  m.step(0x1cd6, 7); // ld a,(hl)
  regs.add(regs.b); // signed: B = +1 / -1 / 0xFF
  m.step(0x1cd7, 4); // add a,b
  mem.write8(regs.hl, regs.a);
  m.step(0x1cd8, 7); // ld (hl),a
  regs.a = mem.read8(0x6227);
  m.step(0x1cdb, 13); // ld a,(0x6227)
  regs.a = regs.dec8(regs.a);
  m.step(0x1cdc, 4); // dec a
  if (regs.fNZ) { m.step(0x1ceb, 10); return m.call(0x1ceb); } // jp nz
  m.step(0x1cdf, 5);
  regs.h = mem.read8(regs.hl); // ld h,(hl) -- HL=0x6203, H = (0x6203)
  m.step(0x1ce0, 7); // ld h,(hl)
  regs.a = mem.read8(0x6205);
  m.step(0x1ce3, 13); // ld a,(0x6205)
  regs.l = regs.a; // HL = ((0x6203)<<8)|(0x6205)
  m.step(0x1ce4, 4); // ld l,a
  m.push16(0x1ce7);
  m.step(0x2333, 17); // call 0x2333
  m.call(0x2333); // clamp; returns L
  regs.a = regs.l;
  m.step(0x1ce8, 4); // ld a,l
  mem.write8(0x6205, regs.a);
  m.step(0x1ceb, 13); // ld (0x6205),a
  return m.call(0x1ceb);
}
