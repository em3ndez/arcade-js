// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1459  (ROM 0x1459–0x1472) — 141E interior: 0x7D82 hardware write, then 12 sub_309f enqueues.
 */
export function loc_1459(m) {
  const { regs, mem } = m;
  regs.hl = 0x6026;
  m.step(0x145c, 10); // ld hl,0x6026
  regs.or(mem.read8(regs.hl)); // A |= (0x6026)
  m.step(0x145d, 7); // or (hl)
  mem.write8(0x7d82, regs.a); // HARDWARE WRITE (flipscreen latch)
  m.step(0x1460, 13); // ld (0x7d82),a
  regs.a = 0x00;
  m.step(0x1462, 7); // ld a,0x00
  mem.write8(0x6009, regs.a); // clear the rst 0x18 counter
  m.step(0x1465, 13);
  regs.hl = 0x600a;
  m.step(0x1468, 10); // ld hl,0x600a
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (0x600a)
  m.step(0x1469, 11);
  regs.de = 0x030d;
  m.step(0x146c, 10); // ld de,0x030d
  regs.b = 0x0c;
  do {
    m.push16(0x1471);
    m.step(0x309f, 17); // call 0x309f
    m.call(0x309f); // DE sweeps 0x030D..0x0318
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x1472, 6); // inc de
    regs.b = (regs.b - 1) & 0xff;
    m.step(regs.b !== 0 ? 0x146e : 0x1474, regs.b !== 0 ? 13 : 8); // djnz 0x146e
  } while (regs.b !== 0);
  m.ret(10); // ret (0x1474)
}
