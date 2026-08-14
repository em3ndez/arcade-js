// SPDX-License-Identifier: GPL-3.0-only

// loc_07e6  (ROM 0x07E6-0x0803) — clear the current player's work RAM: return in a 1-player game
// ((0x83FE)==1), else fall through into loc_07eb (below) which does the clear. Called at game-start
// and from loc_0457.
export function loc_07e6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fe);
  m.step(0x07e9, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x07ea, 4); // Z iff (0x83fe) == 1 (single player)
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x07eb, 5); // ret z not taken -- fall through into loc_07eb
  return m.call(0x07eb);
}

// loc_07eb  (ROM 0x07EB-0x0803) — force the clear: zero 0x8044-0x8063 and 0x8420-0x842B via two
// LDIRs, unconditionally. loc_0567 (B4) enters here directly to skip the single-player check.
export function loc_07eb(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x07ec, 4);
  regs.hl = 0x8044;
  m.step(0x07ef, 10);
  regs.de = 0x8045;
  m.step(0x07f2, 10);
  regs.bc = 0x001f;
  m.step(0x07f5, 10);
  mem.write8(regs.hl, regs.b);
  m.step(0x07f6, 7); // seed (0x8044) = 0
  m.ldirAt(0x07f6, 0x07f8); // clear 0x8044-0x8063

  regs.hl = 0x8420;
  m.step(0x07fb, 10);
  regs.de = 0x8421;
  m.step(0x07fe, 10);
  regs.c = 0x0b;
  m.step(0x0800, 7); // B still 0, so BC = 0x000b
  mem.write8(regs.hl, regs.a);
  m.step(0x0801, 7); // seed (0x8420) = 0 (A = 0)
  m.ldirAt(0x0801, 0x0803); // clear 0x8420-0x842b
  m.ret();
}
