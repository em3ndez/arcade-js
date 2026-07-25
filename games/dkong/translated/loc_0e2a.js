// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0e2a  (ROM 0x0E2A–0x0E4E) — the end cap: writes the run's far-end glyph, then steps the table pointer and re-enters the walk.
 *
 *   0e2a  3a b0 63     ld   a,(0x63b0)
 *   0e2d  c6 d0        add  a,0xd0
 *   0e2f  2a ad 63     ld   hl,(0x63ad)
 *   0e32  77           ld   (hl),a
 *   0e33  3a b3 63     ld   a,(0x63b3)
 *   0e36  fe 01        cp   0x01
 *   0e38  c2 3f 0e     jp   nz,0x0e3f
 *   0e3b  2d           dec  l
 *   0e3c  36 c0        ld   (hl),0xc0
 *   0e3e  2c           inc  l
 *   0e3f  3a b0 63     ld   a,(0x63b0)      ; loc_0e3f
 *   0e42  fe 00        cp   0x00
 *   0e44  ca 4b 0e     jp   z,0x0e4b
 *   0e47  c6 e0        add  a,0xe0
 *   0e49  2c           inc  l
 *   0e4a  77           ld   (hl),a
 *   0e4b  13           inc  de              ; loc_0e4b
 *   0e4c  c3 a7 0d     jp   0x0da7
 *
 * THE END CAP. loc_0e19 filled the span with 0xC0; this reloads HL from
 * 0x63AD -- the SECOND point's tile address -- and writes a tile derived
 * from that point's sub-tile x. So the run gets a distinct glyph at its far
 * end, and for kind 1 a second one written BACKWARDS via `dec l`.
 *
 * `cp 0x00` rather than `and a` or `or a`: all three set Z from A, and the
 * ROM spends 7 T-states where 4 would do. Transcribed as written -- the
 * three extra cycles are real and land in the write trace.
 *
 * CLOSES THE RECORD LOOP: `inc de / jp 0x0da7` steps the table pointer past
 * the record and re-enters the walk. Returns here so sub_0da7's `for(;;)`
 * continues rather than recursing.
 */
export function loc_0e2a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x63b0);
  m.step(0x0e2d, 13);
  regs.add(0xd0);
  m.step(0x0e2f, 7);
  regs.hl = mem.read16(0x63ad);
  m.step(0x0e32, 16);
  mem.write8(regs.hl, regs.a);
  m.step(0x0e33, 7);
  regs.a = mem.read8(0x63b3);
  m.step(0x0e36, 13);
  regs.cp(0x01);
  m.step(0x0e38, 7);
  if (regs.fNZ) {
    m.step(0x0e3f, 10); // jp nz taken
  } else {
    m.step(0x0e3b, 10);
    regs.l = regs.dec8(regs.l); // `dec l` -- backwards one cell
    m.step(0x0e3c, 4);
    mem.write8(regs.hl, 0xc0);
    m.step(0x0e3e, 10);
    regs.l = regs.inc8(regs.l);
    m.step(0x0e3f, 4);
  }

  // loc_0e3f
  regs.a = mem.read8(0x63b0);
  m.step(0x0e42, 13);
  regs.cp(0x00);
  m.step(0x0e44, 7);
  if (regs.fZ) {
    m.step(0x0e4b, 10); // jp z taken -- no sub-tile remainder, no extra cell
  } else {
    m.step(0x0e47, 10);
    regs.add(0xe0);
    m.step(0x0e49, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0e4a, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x0e4b, 7);
  }

  // loc_0e4b -- steps past the record and re-enters the walk
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0e4c, 6);
  m.step(0x0da7, 10); // jp 0x0da7 -- TAIL jump, no push
}
