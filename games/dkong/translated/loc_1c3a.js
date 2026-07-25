// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1c3a  (ROM 0x1C3A–0x1C4E) — B==1 -> entry_1c4f; else advance 0x621f, clear the.
 *  5-byte jump record (djnz), tail-jump 0x1da6.
 */
export function loc_1c3a(m) {
  const { regs, mem } = m;
  regs.b = regs.dec8(regs.b);
  m.step(0x1c3b, 4); // dec b
  if (regs.fZ) { m.step(0x1c4f, 10); return m.call(0x1c4f); } // jp z
  m.step(0x1c3e, 10);
  regs.a = regs.inc8(regs.a);
  m.step(0x1c3f, 4); // inc a
  mem.write8(0x621f, regs.a);
  m.step(0x1c42, 13); // ld (0x621f),a
  regs.xor(regs.a);
  m.step(0x1c43, 4); // xor a
  regs.hl = 0x6210;
  m.step(0x1c46, 10); // ld hl,0x6210
  regs.b = 0x05;
  m.step(0x1c48, 7); // ld b,0x05
  do {
    // loc_1c48 clear loop, B=5
    mem.write8(regs.hl, regs.a);
    m.step(0x1c49, 7); // ld (hl),a
    regs.l = regs.inc8(regs.l);
    m.step(0x1c4a, 4); // inc l
    regs.b = (regs.b - 1) & 0xff; // djnz -- no flags
    m.step(regs.b !== 0 ? 0x1c48 : 0x1c4c, regs.b !== 0 ? 13 : 8); // djnz 0x1c48
  } while (regs.b !== 0);
  m.step(0x1da6, 10); // jp 0x1da6
  return m.call(0x1da6);
}
