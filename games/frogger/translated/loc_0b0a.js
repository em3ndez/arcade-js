// SPDX-License-Identifier: GPL-3.0-only

// loc_0b0a  (ROM 0x0B0A-0x0B1E) — game-start: zero the score words (0x83E7)/(0x83EB)/(0x83ED), then
// set both bytes of (0x83E5) to (0x83E4). Called from the new-game setup (0x03BA).
export function loc_0b0a(m) {
  const { regs, mem } = m;

  regs.hl = 0x0000;
  m.step(0x0b0d, 10);
  mem.write16(0x83ed, regs.hl);
  m.step(0x0b10, 16); // (0x83ed) = 0
  mem.write16(0x83eb, regs.hl);
  m.step(0x0b13, 16); // (0x83eb) = 0
  mem.write16(0x83e7, regs.hl);
  m.step(0x0b16, 16); // (0x83e7) = 0
  regs.a = mem.read8(0x83e4);
  m.step(0x0b19, 13);
  regs.h = regs.a;
  m.step(0x0b1a, 4);
  regs.l = regs.a;
  m.step(0x0b1b, 4);
  mem.write16(0x83e5, regs.hl);
  m.step(0x0b1e, 16); // (0x83e5) = (0x83e4) in both bytes
  m.ret();
}
