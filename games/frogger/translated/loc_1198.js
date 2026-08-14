// SPDX-License-Identifier: GPL-3.0-only

// loc_1198  (ROM 0x1198-0x11BE) — coord/offset compute for the loc_0ff1 render loop. HL-0xA800 is the
// VRAM offset; a 6-pass loop interleaves the H/L bits into C (a tile/column index) while shifting L,H.
export function loc_1198(m) {
  const { regs, mem } = m;

  regs.de = 0xa800; // VRAM base
  m.step(0x119b, 10);
  regs.sbcHl(regs.de);
  m.step(0x119d, 15); // HL = VRAM offset (less borrow)
  regs.a = regs.l;
  m.step(0x119e, 4);
  regs.bc = 0x0600; // B = 6 passes, C = 0 accumulator
  m.step(0x11a1, 10);
  regs.and(0xe0);
  m.step(0x11a3, 7); // A = L & 0xe0
  regs.l = regs.a;
  m.step(0x11a4, 4);

  for (;;) {
    // loc_11a4:
    regs.a = regs.h;
    m.step(0x11a5, 4);
    regs.and(0x04);
    m.step(0x11a7, 7); // Z iff H bit 2 clear
    if (regs.fZ) {
      m.step(0x11b0, 10); // jp z,0x11b0
      // loc_11b0:
      regs.c = regs.rlc(regs.c);
      m.step(0x11b2, 8);
    } else {
      m.step(0x11aa, 10);
      regs.c = regs.rlc(regs.c);
      m.step(0x11ac, 8);
      regs.c = regs.inc8(regs.c);
      m.step(0x11ad, 4); // C bit 0 = the H-bit-2 test
      m.step(0x11b2, 10); // jp 0x11b2
    }
    // loc_11b2:
    regs.l = regs.rlc(regs.l);
    m.step(0x11b4, 8);
    regs.h = regs.rl(regs.h);
    m.step(0x11b6, 8);
    if (regs.djnz() !== 0) {
      m.step(0x11a4, 13); // djnz 0x11a4
      continue;
    }
    m.step(0x11b8, 8);
    break;
  }

  regs.c = regs.rlc(regs.c);
  m.step(0x11ba, 8);
  regs.c = regs.rlc(regs.c);
  m.step(0x11bc, 8);
  regs.c = regs.rlc(regs.c);
  m.step(0x11be, 8);
  m.ret(10);
}
