// SPDX-License-Identifier: GPL-3.0-only

// loc_0695  (ROM 0x0695-0x06A1) — stamp a 2x2 tilemap block at HL (offsets 0,1,0x20,0x21) with
// tile 0x10 -- one home-frog slot marker. Leaf.
export function loc_0695(m) {
  const { regs, mem } = m;

  regs.a = 0x10;
  m.step(0x0697, 7); // A = 0x10 -- the marker tile
  mem.write8(regs.hl, regs.a);
  m.step(0x0698, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0699, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x069a, 7); // top row: HL, HL+1

  regs.bc = 0x001f;
  m.step(0x069d, 10);
  regs.addHl(regs.bc);
  m.step(0x069e, 11); // HL += 0x1f -> one tile row down, one column back

  mem.write8(regs.hl, regs.a);
  m.step(0x069f, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x06a0, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x06a1, 7); // bottom row: HL+0x20, HL+0x21

  m.ret();
}
