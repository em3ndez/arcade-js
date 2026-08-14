// SPDX-License-Identifier: GPL-3.0-only

// loc_07d9  (ROM 0x07D9-0x07E5) — game-start: zero the 0x30-byte timer block at 0x8300-0x832F
// (seed (0x8300)=0 with `ld (hl),b`, then LDIR). Called from the new-game setup (0x03C2).
export function loc_07d9(m) {
  const { regs, mem } = m;

  regs.hl = 0x8300;
  m.step(0x07dc, 10);
  regs.de = 0x8301;
  m.step(0x07df, 10);
  regs.bc = 0x002f;
  m.step(0x07e2, 10);
  mem.write8(regs.hl, regs.b);
  m.step(0x07e3, 7); // seed (0x8300) = 0
  m.ldirAt(0x07e3, 0x07e5); // clear 0x8300-0x832f
  m.ret();
}
