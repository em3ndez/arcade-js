// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2797  (ROM 0x2797–0x27C5) — animate 6 objects (IX=0x6600 stride 0x10): active + (ix+0d) bit3 -> dec (ix+5) to 0x60 (land), else inc to 0xF8 (deactivate).
 */
export function loc_2797(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.b = 0x06;
  m.step(0x2799, 7);
  regs.de = 0x0010;
  m.step(0x279c, 10);
  regs.ix = 0x6600;
  m.step(0x27a0, 14);
  do {
    if (!regs.bit(0, mem.read8(R(0x00)))) {
      m.step(0x27c2, 30); // bit 0,(ix+0) + jp z,0x27c2 -- inactive
    } else {
      m.step(0x27a7, 20);
      if (!regs.bit(3, mem.read8(R(0x0d)))) {
        m.step(0x27c7, 30); // bit3 clear -> increment arm (rise/deactivate)
        const a = (mem.read8(R(0x05)) + 1) & 0xff;
        mem.write8(R(0x05), a);
        m.step(0x27ce, 38);
        regs.a = a;
        regs.cp(0xf8);
        m.step(0x27d0, 7);
        if (a !== 0xf8) {
          m.step(0x27c2, 10);
        } else {
          m.step(0x27d3, 10);
          mem.write8(R(0x00), 0x00);
          m.step(0x27c2, 29); // deactivate
        }
      } else {
        const a = (mem.read8(R(0x05)) - 1) & 0xff;
        mem.write8(R(0x05), a);
        m.step(0x27b5, 38);
        regs.a = a;
        regs.cp(0x60);
        m.step(0x27b7, 7);
        if (a !== 0x60) {
          m.step(0x27c2, 10);
        } else {
          m.step(0x27ba, 10);
          mem.write8(R(0x03), 0x77);
          m.step(0x27be, 19);
          mem.write8(R(0x0d), 0x04);
          m.step(0x27c2, 19); // land
        }
      }
    }
    regs.ix = (regs.ix + regs.de) & 0xffff;
    m.step(0x27c4, 15); // add ix,de
    regs.djnz();
    m.step(regs.b ? 0x27a0 : 0x27c6, regs.b ? 13 : 8);
  } while (regs.b);
  m.ret(10);
}
