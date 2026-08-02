// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0207  (ROM 0x0207–0x0265) — decode the dip switches.
 *
 *   0207  3a 80 7d     ld   a,(0x7d80)
 *   020a  4f           ld   c,a
 *   020b  21 20 60     ld   hl,0x6020
 *   020e  e6 03        and  0x03
 *   0210  c6 03        add  a,0x03
 *   0212  77           ld   (hl),a
 *   0213  23           inc  hl
 *   0214  79           ld   a,c
 *   0215  0f           rrca
 *   0216  0f           rrca
 *   0217  e6 03        and  0x03
 *   0219  47           ld   b,a
 *   021a  3e 07        ld   a,0x07
 *   021c  ca 26 02     jp   z,0x0226
 *   021f  3e 05        ld   a,0x05
 *   0221  c6 05        add  a,0x05           ; loc_0221
 *   0223  27           daa
 *   0224  10 fb        djnz 0x0221
 *   0226  77           ld   (hl),a           ; loc_0226
 *   0227  23           inc  hl
 *   0228  79           ld   a,c
 *   0229  01 01 01     ld   bc,0x0101
 *   022c  11 02 01     ld   de,0x0102
 *   022f  e6 70        and  0x70
 *   0231  17           rla
 *   0232  17           rla
 *   0233  17           rla
 *   0234  17           rla
 *   0235  ca 47 02     jp   z,0x0247
 *   0238  da 41 02     jp   c,0x0241
 *   023b  3c           inc  a
 *   023c  4f           ld   c,a
 *   023d  5a           ld   e,d
 *   023e  c3 47 02     jp   0x0247
 *   0241  c6 02        add  a,0x02           ; loc_0241
 *   0243  47           ld   b,a
 *   0244  57           ld   d,a
 *   0245  87           add  a,a
 *   0246  5f           ld   e,a
 *   0247  72           ld   (hl),d           ; loc_0247
 *   0248  23           inc  hl
 *   0249  73           ld   (hl),e
 *   024a  23           inc  hl
 *   024b  70           ld   (hl),b
 *   024c  23           inc  hl
 *   024d  71           ld   (hl),c
 *   024e  23           inc  hl
 *   024f  3a 80 7d     ld   a,(0x7d80)
 *   0252  07           rlca
 *   0253  3e 01        ld   a,0x01
 *   0255  da 59 02     jp   c,0x0259
 *   0258  3d           dec  a
 *   0259  77           ld   (hl),a           ; loc_0259
 *   025a  21 65 35     ld   hl,0x3565
 *   025d  11 00 61     ld   de,0x6100
 *   0260  01 aa 00     ld   bc,0x00aa
 *   0263  ed b0        ldir
 *   0265  c9           ret
 *
 * Unpacks DSW0 into the settings block at 0x6020:
 *   bits 0-1  lives          -> 0x6020 = value + 3
 *   bits 2-3  bonus life     -> 0x6021, BCD: 7 when zero, else 5+5n via `daa`
 *   bits 4-6  coinage        -> 0x6022-0x6025 as four related counters
 *   bit 7     (re-read)      -> 0x6026, the two-player/alternation flag
 *
 * NOTE the `jp z` at 0x021C tests the `and 0x03` from 0x0217 -- the two `ld`s
 * between them do not touch flags. Same shape as the NMI's control read.
 *
 * The bonus threshold is genuine BCD (`add a,0x05 / daa`), so it depends on
 * exact DAA semantics. Its result feeds 0x6021, which sub_0350 compares the
 * packed score against.
 *
 * Ends with an `ldir` of 0xAA bytes from ROM 0x3565 to 0x6100 -- a 170-byte
 * table copied into work RAM, so that ROM span is data.
 */
export function loc_0207(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x7d80); // DSW0
  m.step(0x020a, 13);
  regs.c = regs.a;
  m.step(0x020b, 4);
  regs.hl = 0x6020;
  m.step(0x020e, 10);
  regs.and(0x03);
  m.step(0x0210, 7);
  regs.add(0x03);
  m.step(0x0212, 7);
  mem.write8(regs.hl, regs.a); // lives
  m.step(0x0213, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0214, 6);

  regs.a = regs.c;
  m.step(0x0215, 4);
  regs.rrca();
  m.step(0x0216, 4);
  regs.rrca();
  m.step(0x0217, 4);
  regs.and(0x03);
  m.step(0x0219, 7);
  const zero = regs.fZ; // captured BEFORE the flag-neutral loads below
  regs.b = regs.a;
  m.step(0x021a, 4);
  regs.a = 0x07;
  m.step(0x021c, 7);
  if (zero) {
    m.step(0x0226, 10); // jp z taken -- bonus stays 7
  } else {
    m.step(0x021f, 10);
    regs.a = 0x05;
    m.step(0x0221, 7);
    do {
      regs.add(0x05);
      m.step(0x0223, 7);
      regs.daa(); // BCD -- exact semantics matter here
      m.step(0x0224, 4);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x0221 : 0x0226, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
  }

  mem.write8(regs.hl, regs.a); // bonus threshold
  m.step(0x0227, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0228, 6);
  regs.a = regs.c;
  m.step(0x0229, 4);
  regs.bc = 0x0101;
  m.step(0x022c, 10);
  regs.de = 0x0102;
  m.step(0x022f, 10);
  regs.and(0x70); // coinage bits
  m.step(0x0231, 7);
  for (const nxt of [0x0232, 0x0233, 0x0234, 0x0235]) {
    regs.rla();
    m.step(nxt, 4);
  }

  if (regs.fZ) {
    m.step(0x0247, 10); // jp z -- defaults already in BC/DE
  } else {
    m.step(0x0238, 10);
    if (regs.fC) {
      m.step(0x0241, 10);
      regs.add(0x02);
      m.step(0x0243, 7);
      regs.b = regs.a;
      m.step(0x0244, 4);
      regs.d = regs.a;
      m.step(0x0245, 4);
      regs.add(regs.a); // add a,a
      m.step(0x0246, 4);
      regs.e = regs.a;
      m.step(0x0247, 4);
    } else {
      m.step(0x023b, 10);
      regs.a = regs.inc8(regs.a);
      m.step(0x023c, 4);
      regs.c = regs.a;
      m.step(0x023d, 4);
      regs.e = regs.d;
      m.step(0x023e, 4);
      m.step(0x0247, 10); // jp 0x0247
    }
  }

  // loc_0247: store D, E, B, C into 0x6022-0x6025
  for (const [v, nxt, inc] of [
    [regs.d, 0x0248, 0x0249], [regs.e, 0x024a, 0x024b],
    [regs.b, 0x024c, 0x024d], [regs.c, 0x024e, 0x024f],
  ]) {
    mem.write8(regs.hl, v);
    m.step(nxt, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(inc, 6);
  }

  regs.a = mem.read8(0x7d80); // DSW0 again
  m.step(0x0252, 13);
  regs.rlca(); // bit 7 into carry
  m.step(0x0253, 4);
  regs.a = 0x01;
  m.step(0x0255, 7);
  if (regs.fC) {
    m.step(0x0259, 10); // jp c taken -- A stays 1
  } else {
    m.step(0x0258, 10);
    regs.a = regs.dec8(regs.a); // A = 0
    m.step(0x0259, 4);
  }
  mem.write8(regs.hl, regs.a);
  m.step(0x025a, 7);

  regs.hl = 0x3565;
  m.step(0x025d, 10);
  regs.de = 0x6100;
  m.step(0x0260, 10);
  regs.bc = 0x00aa;
  m.step(0x0263, 10);
  m.ldirAt(0x0263, 0x0265);

  m.ret();
}
