// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0315  (ROM 0x0315–0x0346) — every 16th frame, writes three video-RAM cells stepping one tilemap row back per cell.
 *
 *   0315  3a 1a 60     ld   a,(0x601a)
 *   0318  47           ld   b,a
 *   0319  e6 0f        and  0x0f
 *   031b  c0           ret  nz
 *   031c  cf           rst  0x08
 *   031d  3a 0d 60     ld   a,(0x600d)
 *   0320  cd 47 03     call 0x0347
 *   0323  11 e0 ff     ld   de,0xffe0
 *   0326  cb 60        bit  4,b
 *   0328  28 14        jr   z,0x033e
 *   032a  3e 10        ld   a,0x10
 *   032c  77           ld   (hl),a
 *   032d  19           add  hl,de
 *   032e  77           ld   (hl),a
 *   032f  19           add  hl,de
 *   0330  77           ld   (hl),a
 *   0331  3a 0f 60     ld   a,(0x600f)
 *   0334  a7           and  a
 *   0335  c8           ret  z
 *   0336  3a 0d 60     ld   a,(0x600d)
 *   0339  ee 01        xor  0x01
 *   033b  cd 47 03     call 0x0347
 *   033e  3c           inc  a                ; loc_033e
 *   033f  77           ld   (hl),a
 *   0340  19           add  hl,de
 *   0341  36 25        ld   (hl),0x25
 *   0343  19           add  hl,de
 *   0344  36 20        ld   (hl),0x20
 *   0346  c9           ret
 *
 * Runs only every 16th frame (`and 0x0f / ret nz`) and writes three video RAM
 * cells, stepping DE = 0xFFE0 (-32) between them -- one screen row back per
 * step in the 32-column tilemap.
 */
export function loc_0315(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x601a);
  m.step(0x0318, 13);
  regs.b = regs.a;
  m.step(0x0319, 4);
  regs.and(0x0f);
  m.step(0x031b, 7);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- not a multiple-of-16 frame
    return;
  }
  m.step(0x031c, 5);

  // rst 0x08 -- may skip the remainder of THIS routine by returning past it.
  m.push16(0x031d);
  m.step(0x0008, 11);
  if (!m.call(0x0008)) return;

  regs.a = mem.read8(0x600d);
  m.step(0x0320, 13);
  m.push16(0x0323);
  m.step(0x0347, 17);
  m.call(0x0347); // HL = column base

  regs.de = 0xffe0; // -32: one tilemap row
  m.step(0x0326, 10);

  const bit4 = regs.bit(4, regs.b);
  m.step(0x0328, 8); // bit 4,b
  if (!bit4) {
    m.step(0x033e, 12); // jr z taken -> loc_033e
  } else {
    m.step(0x032a, 7);
    regs.a = 0x10;
    m.step(0x032c, 7);
    const STORES = [0x032d, 0x032f, 0x0331];
    const ADDS = [0x032e, 0x0330];
    for (let i = 0; i < 3; i++) {
      mem.write8(regs.hl, regs.a);
      m.step(STORES[i], 7);
      if (i < 2) {
        regs.addHl(regs.de);
        m.step(ADDS[i], 11);
      }
    }
    regs.a = mem.read8(0x600f);
    m.step(0x0334, 13);
    regs.and(regs.a);
    m.step(0x0335, 4);
    if (regs.fZ) {
      m.ret(11);
      return;
    }
    m.step(0x0336, 5);
    regs.a = mem.read8(0x600d);
    m.step(0x0339, 13);
    regs.xor(0x01);
    m.step(0x033b, 7);
    m.push16(0x033e);
    m.step(0x0347, 17);
    m.call(0x0347);
  }

  // loc_033e
  regs.a = regs.inc8(regs.a);
  m.step(0x033f, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x0340, 7);
  regs.addHl(regs.de);
  m.step(0x0341, 11);
  mem.write8(regs.hl, 0x25);
  m.step(0x0343, 10);
  regs.addHl(regs.de);
  m.step(0x0344, 11);
  mem.write8(regs.hl, 0x20);
  m.step(0x0346, 10);
  m.ret();
}
