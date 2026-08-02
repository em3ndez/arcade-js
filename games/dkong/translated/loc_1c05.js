// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1c05  (ROM 0x1C05–0x1C32) — 2b1c dispatch + the LIVE 0x1C23 block.
 */
export function loc_1c05(m, X) {
  const { regs, mem } = m;
  m.push16(0x1c08);
  m.step(0x2b1c, 17); // call 0x2b1c
  m.call(0x2b1c); // returns A (0x1C08 always resumes here)
  regs.a = regs.dec8(regs.a);
  m.step(0x1c09, 4); // dec a
  if (regs.fZ) { m.step(0x1c3a, 10); return m.call(0x1c3a); } // jp z
  m.step(0x1c0c, 10);
  regs.a = mem.read8(0x621f);
  m.step(0x1c0f, 13); // ld a,(0x621f)
  regs.a = regs.dec8(regs.a);
  m.step(0x1c10, 4); // dec a
  if (regs.fZ) { m.step(0x1c76, 10); return m.call(0x1c76); } // jp z
  m.step(0x1c13, 10);
  regs.a = mem.read8(0x6214);
  m.step(0x1c16, 13); // ld a,(0x6214)
  regs.sub(0x14);
  m.step(0x1c18, 7); // sub 0x14
  if (regs.fNZ) { m.step(0x1c33, 10); return m.call(0x1c33); } // jp nz
  m.step(0x1c1b, 5);
  regs.a = 0x01;
  m.step(0x1c1d, 7); // ld a,0x01
  mem.write8(0x621f, regs.a);
  m.step(0x1c20, 13); // ld (0x621f),a
  m.push16(0x1c23);
  m.step(0x2853, 17); // call 0x2853 (returns normally)
  m.call(0x2853);
  // ---- 0x1C23-0x1C32: LIVE CODE hidden as `defb UNREACHED` in the listing ----
  regs.and(regs.a); // A = sub_2853's return (from the 3e88 dispatch target)
  m.step(0x1c24, 4); // and a
  if (regs.fZ) { m.step(0x1da6, 10); return m.call(0x1da6); } // jp z,0x1da6
  m.step(0x1c27, 10);
  mem.write8(0x6342, regs.a);
  m.step(0x1c2a, 13); // ld (0x6342),a
  regs.a = 0x01;
  m.step(0x1c2c, 7); // ld a,0x01
  mem.write8(0x6340, regs.a);
  m.step(0x1c2f, 13); // ld (0x6340),a
  mem.write8(0x6225, regs.a);
  m.step(0x1c32, 13); // ld (0x6225),a
  m.step(0x1c33, 4); // nop @ 0x1C32, fall into loc_1c33
  return m.call(0x1c33);
}
