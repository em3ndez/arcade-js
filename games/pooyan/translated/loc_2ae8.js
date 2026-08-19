// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2ae8  (ROM 0x2ae8-0x2b03) -- 0x8a80 actor state 7 (dispatch 0x28f1[7]): teardown. Zeroes the
// whole 0x0240-byte actor block 0x8a80.., clears the counters 0x8902/0x8903/0x8931, and forces the
// secondary state (0x880a)=6.
export function loc_2ae8(m) {
  const { regs, mem } = m;

  regs.xor(regs.a); m.step(0x2ae9, 4);
  regs.hl = 0x8a80; m.step(0x2aec, 10);
  mem.write8(regs.hl, regs.a); m.step(0x2aed, 7); // 2aec  ld (hl),a
  regs.de = 0x8a81; m.step(0x2af0, 10);
  regs.bc = 0x0240; m.step(0x2af3, 10);
  m.ldirAt(0x2af3, 0x2af5); // 2af3  ldir (propagate 0 across the block)
  mem.write8(0x8902, regs.a); m.step(0x2af8, 13); // 2af5  ld (0x8902),a
  mem.write8(0x8903, regs.a); m.step(0x2afb, 13); // 2af8  ld (0x8903),a
  mem.write8(0x8931, regs.a); m.step(0x2afe, 13); // 2afb  ld (0x8931),a
  regs.a = 0x06; m.step(0x2b00, 7);
  mem.write8(0x880a, regs.a); m.step(0x2b03, 13); // 2b00  ld (0x880a),a
  m.ret();
}
