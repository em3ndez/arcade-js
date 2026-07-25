// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0464  (ROM 0x0464–0x0472) — counter hit 0x80 -> reset (0x6390)/(0x6391); (0x6393)==0 -> table copy; back to loc_0450.
 */
export function loc_0464(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x0465, 4); // xor a
  mem.write8(regs.hl, regs.a); // hl == 0x6390
  m.step(0x0466, 7); // ld (hl),a -- (0x6390)=0
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0467, 6); // inc hl -> 0x6391
  mem.write8(regs.hl, regs.a);
  m.step(0x0468, 7); // ld (hl),a -- (0x6391)=0
  regs.a = mem.read8(0x6393);
  m.step(0x046b, 13); // ld a,(0x6393)
  regs.and(regs.a);
  m.step(0x046c, 4); // and a
  if (regs.fNZ) { m.step(0x0486, 10); return m.call(0x0486); } // jp nz,0x0486
  m.step(0x046f, 10); // (6393)==0 (COLD arm)
  regs.hl = 0x385c;
  m.step(0x0472, 10); // ld hl,0x385c
  m.push16(0x0475); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  m.step(0x0450, 10); // jp 0x0450 (BACKWARD rejoin, not a loop)
  return m.call(0x0450);
}
