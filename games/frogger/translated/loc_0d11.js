// SPDX-License-Identifier: GPL-3.0-only

// loc_0d11  (ROM 0x0D11-0x0D4B) — intro/mode state machine. Gated by the (0x83D8) frame timer (returns
// while nonzero); then a cp-ladder on the mode byte (0x83D6) dispatches to the mode-3 board setup
// (0x0BB3), the in-play init (0x0D4C when (0x83E1)!=0), the mode-4 marquee (0x0C6D), or mode-2 (0x2D88).
// Mode 5 falls through to the reset arm (0x0D35): reload the (0x83D8) timer to 0x30, clear (0x83D7)/
// (0x8015), blit a strip (rst 0x28), and jp 0x0C17.
export function loc_0d11(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83d8);
  m.step(0x0d14, 13); // A = (0x83d8) intro frame timer
  regs.or(regs.a);
  m.step(0x0d15, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- timer still running
    return;
  }
  m.step(0x0d16, 5);

  regs.a = mem.read8(0x83d6);
  m.step(0x0d19, 13); // A = (0x83d6) mode byte
  regs.cp(0x03);
  m.step(0x0d1b, 7);
  if (regs.fZ) {
    m.step(0x0bb3, 10); // jp z,0x0bb3 -- mode 3 board setup
    return m.call(0x0bb3);
  }
  m.step(0x0d1e, 10);

  regs.a = mem.read8(0x83e1);
  m.step(0x0d21, 13); // A = (0x83e1) in-play flag
  regs.or(regs.a);
  m.step(0x0d22, 4);
  if (regs.fNZ) {
    m.step(0x0d4c, 10); // jp nz,0x0d4c -- in-play board init
    return m.call(0x0d4c);
  }
  m.step(0x0d25, 10);

  regs.a = mem.read8(0x83d6);
  m.step(0x0d28, 13);
  regs.cp(0x04);
  m.step(0x0d2a, 7);
  if (regs.fZ) {
    m.step(0x0c6d, 10); // jp z,0x0c6d -- mode 4 attract marquee
    return m.call(0x0c6d);
  }
  m.step(0x0d2d, 10);

  regs.cp(0x02);
  m.step(0x0d2f, 7);
  if (regs.fZ) {
    m.step(0x2d88, 10); // jp z,0x2d88 -- mode 2
    return m.call(0x2d88);
  }
  m.step(0x0d32, 10);

  regs.cp(0x05);
  m.step(0x0d34, 7);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- mode is none of 2/3/4/5
    return;
  }
  m.step(0x0d35, 5);

  // 0x0D35 mode-5 reset arm (fall-through only; no external entry)
  regs.hl = 0x83d8;
  m.step(0x0d38, 10);
  mem.write8(regs.hl, 0x30);
  m.step(0x0d3a, 10); // (0x83d8) = 0x30 reseed timer
  regs.l = regs.dec8(regs.l);
  m.step(0x0d3b, 4); // HL -> 0x83d7
  regs.xor(regs.a);
  m.step(0x0d3c, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x0d3d, 7); // (0x83d7) = 0
  mem.write8(0x8015, regs.a);
  m.step(0x0d40, 13); // (0x8015) = 0
  regs.de = 0x2f01;
  m.step(0x0d43, 10);
  regs.hl = 0xaaca;
  m.step(0x0d46, 10);
  regs.b = 0x0d;
  m.step(0x0d48, 7);
  m.push16(0x0d49);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x0d tiles
  m.call(0x0028);
  m.step(0x0c17, 10); // jp 0x0c17
  return m.call(0x0c17);
}
