// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_00e0  (ROM 0x00E0–0x011B) — sound driver tick.
 *
 *   00e0  21 80 60     ld   hl,0x6080
 *   00e3  11 00 7d     ld   de,0x7d00
 *   00e6  3a 07 60     ld   a,(0x6007)
 *   00e9  a7           and  a
 *   00ea  c0           ret  nz
 *   00eb  06 08        ld   b,0x08
 *   00ed  7e           ld   a,(hl)          ; loop
 *   00ee  a7           and  a
 *   00ef  ca f5 00     jp   z,0x00f5
 *   00f2  35           dec  (hl)
 *   00f3  3e 01        ld   a,0x01
 *   00f5  12           ld   (de),a
 *   00f6  1c           inc  e
 *   00f7  2c           inc  l
 *   00f8  10 f3        djnz 0x00ed
 *   00fa  21 8b 60     ld   hl,0x608b
 *   00fd  7e           ld   a,(hl)
 *   00fe  a7           and  a
 *   00ff  c2 08 01     jp   nz,0x0108
 *   0102  2d           dec  l
 *   0103  2d           dec  l
 *   0104  7e           ld   a,(hl)
 *   0105  c3 0b 01     jp   0x010b
 *   0108  35           dec  (hl)            ; loc_0108
 *   0109  2d           dec  l
 *   010a  7e           ld   a,(hl)
 *   010b  32 00 7c     ld   (0x7c00),a      ; loc_010b
 *   010e  21 88 60     ld   hl,0x6088
 *   0111  af           xor  a
 *   0112  be           cp   (hl)
 *   0113  ca 18 01     jp   z,0x0118
 *   0116  35           dec  (hl)
 *   0117  3c           inc  a               ; loc_0117
 *   0118  32 80 7d     ld   (0x7d80),a
 *   011b  c9           ret
 *
 * Walks the eight shadow bytes at 0x6080-0x6087 in step with the eight
 * ls259.6h latch addresses 0x7D00-0x7D07: each non-zero shadow is decremented
 * and its latch bit driven to 1, so a shadow byte is a countdown holding a
 * sound trigger asserted for N frames. This is why sub_011c zeroes both the
 * latch and the shadows -- the shadows are the readable copy of a write-only
 * device, and they land in the state dump.
 *
 * Note `inc e` / `inc l` (8-bit) walk DE and HL in lockstep; the high bytes
 * are fixed at 0x7D and 0x60.
 *
 * The tail drives the ls175.3d latch (0x7C00) from 0x6089/0x608B and the
 * audio IRQ (0x7D80) from 0x6088.
 */
export function loc_00e0(m) {
  const { regs, mem } = m;

  regs.hl = 0x6080;
  m.step(0x00e3, 10);
  regs.de = 0x7d00;
  m.step(0x00e6, 10);
  regs.a = mem.read8(0x6007);
  m.step(0x00e9, 13);
  regs.and(regs.a);
  m.step(0x00ea, 4);
  if (regs.fNZ) {
    m.step(m.pop16(), 11); // ret nz
    return;
  }
  m.step(0x00eb, 5);

  regs.b = 0x08;
  m.step(0x00ed, 7);
  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x00ee, 7);
    regs.and(regs.a);
    m.step(0x00ef, 4);
    if (regs.fZ) {
      m.step(0x00f5, 10); // jp z taken -- shadow already 0, drive latch 0
    } else {
      m.step(0x00f2, 10);
      mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
      m.step(0x00f3, 11);
      regs.a = 0x01;
      m.step(0x00f5, 7);
    }
    mem.write8(regs.de, regs.a, 4); // ls259.6h bit, ld (de),a
    m.step(0x00f6, 7);
    regs.e = (regs.e + 1) & 0xff;
    m.step(0x00f7, 4);
    regs.l = (regs.l + 1) & 0xff;
    m.step(0x00f8, 4);
    regs.b = (regs.b - 1) & 0xff; // djnz -- no flags
    m.step(regs.b !== 0 ? 0x00ed : 0x00fa, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  regs.hl = 0x608b;
  m.step(0x00fd, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x00fe, 7);
  regs.and(regs.a);
  m.step(0x00ff, 4);
  if (regs.fNZ) {
    m.step(0x0108, 10); // jp nz -> loc_0108
    mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
    m.step(0x0109, 11);
    regs.l = (regs.l - 1) & 0xff;
    m.step(0x010a, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x010b, 7);
  } else {
    m.step(0x0102, 10);
    regs.l = (regs.l - 1) & 0xff;
    m.step(0x0103, 4);
    regs.l = (regs.l - 1) & 0xff;
    m.step(0x0104, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x0105, 7);
    m.step(0x010b, 10); // jp 0x010b
  }

  // loc_010b
  mem.write8(0x7c00, regs.a, 10); // ls175.3d sound latch
  m.step(0x010e, 13);
  regs.hl = 0x6088;
  m.step(0x0111, 10);
  regs.xor(regs.a);
  m.step(0x0112, 4);
  regs.cp(mem.read8(regs.hl));
  m.step(0x0113, 7);
  if (regs.fZ) {
    m.step(0x0118, 10); // jp z taken
  } else {
    m.step(0x0116, 10);
    mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
    m.step(0x0117, 11);
    regs.a = regs.inc8(regs.a);
    m.step(0x0118, 4);
  }
  mem.write8(0x7d80, regs.a, 10); // audio IRQ
  m.step(0x011b, 13);
  m.ret();
}
