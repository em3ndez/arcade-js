// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1b55  (ROM 0x1B55–0x1B6D) — the 0x621E lock countdown.
 */
export function loc_1b55(m) {
  const { regs, mem } = m;
  regs.hl = 0x621e;
  m.step(0x1b58, 10); // ld hl,0x621e
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x1b59, 11); // dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- still locked
  m.step(0x1b5a, 5);
  regs.a = mem.read8(0x6218);
  m.step(0x1b5d, 13); // ld a,(0x6218)
  mem.write8(0x6217, regs.a);
  m.step(0x1b60, 13); // ld (0x6217),a
  regs.hl = 0x6207;
  m.step(0x1b63, 10); // ld hl,0x6207
  regs.a = mem.read8(regs.hl);
  m.step(0x1b64, 7); // ld a,(hl)
  regs.and(0x80);
  m.step(0x1b66, 7); // and 0x80
  mem.write8(regs.hl, regs.a);
  m.step(0x1b67, 7); // ld (hl),a
  regs.xor(regs.a);
  m.step(0x1b68, 4); // xor a
  mem.write8(0x6202, regs.a);
  m.step(0x1b6b, 13); // ld (0x6202),a
  m.step(0x1da6, 10); // jp 0x1da6
  return m.call(0x1da6);
}
