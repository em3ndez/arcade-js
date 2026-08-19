// SPDX-License-Identifier: GPL-3.0-only

// loc_0343  (ROM 0x0343-0x0377) — like loc_032a but the two coordinate bytes are computed:
// the 16-bit sub-pixel pair (ix+5:ix+6) / (ix+3:ix+4) is shifted left 3 (top 3 bits of the low
// byte fed into A via rlc c; rla) then biased by -8, giving a screen coord. B moving-object records.
export function loc_0343(m) {
  const { regs, mem } = m;

  do {
    regs.c = mem.read8((regs.ix + 0x05) & 0xffff);
    m.step(0x0346, 19);
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
    m.step(0x0349, 19);
    regs.c = regs.rlc(regs.c);
    m.step(0x034b, 8);
    regs.rla();
    m.step(0x034c, 4);
    regs.c = regs.rlc(regs.c);
    m.step(0x034e, 8);
    regs.rla();
    m.step(0x034f, 4);
    regs.c = regs.rlc(regs.c);
    m.step(0x0351, 8);
    regs.rla();
    m.step(0x0352, 4);
    regs.sub(0x08);
    m.step(0x0354, 7); // A = screen coord (ix+5:ix+6)
    mem.write8(regs.hl, regs.a);
    m.step(0x0355, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0356, 4);

    regs.a = mem.read8((regs.ix + 0x10) & 0xffff);
    m.step(0x0359, 19); // (ix+0x10) raw
    mem.write8(regs.hl, regs.a);
    m.step(0x035a, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x035b, 4);

    regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
    m.step(0x035e, 19);
    regs.c = mem.read8((regs.ix + 0x03) & 0xffff);
    m.step(0x0361, 19);
    regs.c = regs.rlc(regs.c);
    m.step(0x0363, 8);
    regs.rla();
    m.step(0x0364, 4);
    regs.c = regs.rlc(regs.c);
    m.step(0x0366, 8);
    regs.rla();
    m.step(0x0367, 4);
    regs.c = regs.rlc(regs.c);
    m.step(0x0369, 8);
    regs.rla();
    m.step(0x036a, 4);
    regs.sub(0x08);
    m.step(0x036c, 7); // A = screen coord (ix+3:ix+4)
    mem.write8(regs.hl, regs.a);
    m.step(0x036d, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x036e, 4);

    regs.a = mem.read8((regs.ix + 0x0f) & 0xffff);
    m.step(0x0371, 19); // (ix+0x0f) raw
    mem.write8(regs.hl, regs.a);
    m.step(0x0372, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0373, 4);

    regs.addIx(regs.de);
    m.step(0x0375, 15); // next object record
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0343 : 0x0377, regs.b !== 0 ? 13 : 8); // djnz 0x0343
  } while (regs.b !== 0);

  m.ret(); // 0x0377
}
