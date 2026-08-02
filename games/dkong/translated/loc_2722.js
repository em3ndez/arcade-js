// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2722  (ROM 0x2722–0x2744) — animate (2797) + spawn (27da), then mirror (ix+3)/(ix+5) of 6 objects to 0x6958.
 */
export function loc_2722(m) {
  const { regs, mem } = m;
  m.push16(0x2725); m.step(0x2797, 17); m.call(0x2797); // leaves DE=0x10
  m.push16(0x2728); m.step(0x27da, 17); m.call(0x27da); // uses DE=0x10
  regs.b = 0x06;
  m.step(0x272a, 7);
  regs.de = 0x0010;
  m.step(0x272d, 10);
  regs.hl = 0x6958;
  m.step(0x2730, 10);
  regs.ix = 0x6600;
  m.step(0x2734, 14);
  do {
    regs.a = mem.read8((regs.ix + 3) & 0xffff);
    m.step(0x2737, 19);
    mem.write8(regs.hl, regs.a);
    m.step(0x2738, 7);
    regs.l = (regs.l + 1) & 0xff;
    m.step(0x2739, 4);
    regs.l = (regs.l + 1) & 0xff;
    m.step(0x273a, 4);
    regs.l = (regs.l + 1) & 0xff;
    m.step(0x273b, 4);
    regs.a = mem.read8((regs.ix + 5) & 0xffff);
    m.step(0x273e, 19);
    mem.write8(regs.hl, regs.a);
    m.step(0x273f, 7);
    regs.l = (regs.l + 1) & 0xff;
    m.step(0x2740, 4);
    regs.ix = (regs.ix + regs.de) & 0xffff;
    m.step(0x2742, 15);
    regs.djnz();
    m.step(regs.b ? 0x2734 : 0x2744, regs.b ? 13 : 8);
  } while (regs.b);
  m.ret(10);
}
