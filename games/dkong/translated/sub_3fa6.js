// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3fa6  (ROM 0x3FA6–0x3FB9) — writes four tilemap cells (0x776C/0x748C pairs); the HL reload sits inside the djnz loop.
 *
 *   3fa6  3e 02        ld   a,0x02
 *   3fa8  f7           rst  0x30
 *   3fa9  06 02        ld   b,0x02
 *   3fab  21 6c 77     ld   hl,0x776c
 *   3fae  36 10        ld   (hl),0x10       ; loop target
 *   3fb0  23           inc  hl
 *   3fb1  23           inc  hl
 *   3fb2  36 c0        ld   (hl),0xc0
 *   3fb4  21 8c 74     ld   hl,0x748c
 *   3fb7  10 f5        djnz 0x3fae
 *   3fb9  c9           ret
 *
 * `ld hl,0x748c` AT 0x3FB4 IS INSIDE THE LOOP. The `djnz` at 0x3FB7 jumps
 * back to 0x3FAE, so HL is reloaded every iteration and the two passes write
 * to DIFFERENT places: pass 1 uses the 0x776C set before the loop, pass 2
 * uses the 0x748C set at the end of pass 1. Four cells in total --
 * 0x776C/0x776E and 0x748C/0x748E.
 *
 * Hoisting that load out "because it is loop-invariant" would make both
 * passes write the same pair and lose two of the four writes. This is the
 * same in-loop/out-of-loop trap that cost a 7-cycle error in sub_0874, and
 * it is why the loop body is written out rather than parameterised.
 *
 * Two `inc hl` rather than one `inc hl` twice-over: the cells are two apart
 * because tilemap columns are 2 bytes apart in this address layout.
 */
export function sub_3fa6(m) {
  const { regs, mem } = m;

  regs.a = 0x02;
  m.step(0x3fa8, 7);
  m.push16(0x3fa9);
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // skipped: control never came back here

  regs.b = 0x02;
  m.step(0x3fab, 7);
  regs.hl = 0x776c;
  m.step(0x3fae, 10);
  do {
    mem.write8(regs.hl, 0x10);
    m.step(0x3fb0, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x3fb1, 6);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x3fb2, 6);
    mem.write8(regs.hl, 0xc0);
    m.step(0x3fb4, 10);
    regs.hl = 0x748c; // IN the loop -- see the note above
    m.step(0x3fb7, 10);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3fae : 0x3fb9, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret();
}
