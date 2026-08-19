// SPDX-License-Identifier: GPL-3.0-only

// loc_032a  (ROM 0x032A-0x0342) — copy B object records straight into the HL display list:
// four raw bytes per object ((ix+6),(ix+0x10),(ix+4),(ix+0x0f)); IX advances by DE each object.
export function loc_032a(m) {
  const { regs, mem } = m;

  do {
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
    m.step(0x032d, 19); // A = (ix+0x06)
    mem.write8(regs.hl, regs.a);
    m.step(0x032e, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x032f, 4);

    regs.a = mem.read8((regs.ix + 0x10) & 0xffff);
    m.step(0x0332, 19); // A = (ix+0x10)
    mem.write8(regs.hl, regs.a);
    m.step(0x0333, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0334, 4);

    regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
    m.step(0x0337, 19); // A = (ix+0x04)
    mem.write8(regs.hl, regs.a);
    m.step(0x0338, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0339, 4);

    regs.a = mem.read8((regs.ix + 0x0f) & 0xffff);
    m.step(0x033c, 19); // A = (ix+0x0f)
    mem.write8(regs.hl, regs.a);
    m.step(0x033d, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x033e, 4);

    regs.addIx(regs.de);
    m.step(0x0340, 15); // add ix,de -- next object record
    regs.djnz();
    m.step(regs.b !== 0 ? 0x032a : 0x0342, regs.b !== 0 ? 13 : 8); // djnz 0x032a
  } while (regs.b !== 0);

  m.ret(); // 0x0342
}
