// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3f24  (ROM 0x3F24–0x3F2F).
 *
 *   3f24  21 af 74     ld   hl,0x74af
 *   3f27  11 e0 ff     ld   de,0xffe0
 *   3f2a  36 9f        ld   (hl),0x9f
 *   3f2c  19           add  hl,de
 *   3f2d  36 9e        ld   (hl),0x9e
 *   3f2f  c9           ret
 *
 * Writes 0x9F to 0x74AF and 0x9E to 0x748F -- two bytes, 0x20 apart, the
 * second BELOW the first.
 *
 * NO INPUTS. Both HL and DE are loaded from literals; no register or memory
 * cell is read. Unlike sub_004e this routine's behaviour is fully determined
 * by its own twelve bytes.
 *
 * `ld de,0xffe0` + `add hl,de` is a SUBTRACTION BY 0x20 done as an unsigned
 * 16-bit add that wraps: 0x74AF + 0xFFE0 = 0x1748F -> 0x748F. Writing it as
 * `hl -= 0x20` gets the same address and LOSES THE FLAGS.
 *
 * ON EXIT: HL=0x748F, DE=0xFFE0, and CARRY IS SET (always -- both operands
 * are literals, so the wrap is unconditional).
 */
export function sub_3f24(m) {
  const { regs, mem } = m;

  regs.hl = 0x74af;
  m.step(0x3f27, 10);
  regs.de = 0xffe0;
  m.step(0x3f2a, 10);

  mem.write8(regs.hl, 0x9f);
  m.step(0x3f2c, 10);

  // MUST be addHl(0xffe0), not `hl -= 0x20`. Same address, different
  // flags -- this add always carries, and the carry escapes via `ret`.
  regs.addHl(regs.de);
  m.step(0x3f2d, 11);

  mem.write8(regs.hl, 0x9e);
  m.step(0x3f2f, 10);

  m.ret(); // 3f2f -- unconditional, 10 T
}
