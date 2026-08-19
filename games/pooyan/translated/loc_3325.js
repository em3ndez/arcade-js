// SPDX-License-Identifier: GPL-3.0-only

// loc_3325  (ROM 0x3325-0x3336) -- blit a 2x2 tile block. Copies four source bytes at (DE) into the
// video-RAM square anchored at (HL): top-left, top-right (HL+1), bottom-right (HL+0x21), bottom-left
// (HL+0x20); BC=0x20 is the row stride. Only three `inc de` run, so DE ends at source+3 (on the last
// byte, not past it); HL ends on the bottom-left cell.
// The data at 0x3337-0x3376 (following this ret) is a tile/coordinate TABLE, not code -- read from
// ROM directly, so it is not translated here.
export function loc_3325(m) {
  const { regs, mem } = m;

  regs.bc = 0x0020; m.step(0x3328, 10); // 3325  ld bc,0x0020 (row stride)
  regs.a = mem.read8(regs.de); m.step(0x3329, 7); // 3328  ld a,(de)
  mem.write8(regs.hl, regs.a); m.step(0x332a, 7); // top-left
  regs.de = (regs.de + 1) & 0xffff; m.step(0x332b, 6);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x332c, 6);
  regs.a = mem.read8(regs.de); m.step(0x332d, 7);
  mem.write8(regs.hl, regs.a); m.step(0x332e, 7); // top-right
  regs.de = (regs.de + 1) & 0xffff; m.step(0x332f, 6);
  regs.addHl(regs.bc); m.step(0x3330, 11); // 332f  add hl,bc -- HL = anchor + 0x21
  regs.a = mem.read8(regs.de); m.step(0x3331, 7);
  mem.write8(regs.hl, regs.a); m.step(0x3332, 7); // bottom-right
  regs.de = (regs.de + 1) & 0xffff; m.step(0x3333, 6);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x3334, 6); // 3333  dec hl -- HL = anchor + 0x20
  regs.a = mem.read8(regs.de); m.step(0x3335, 7);
  mem.write8(regs.hl, regs.a); m.step(0x3336, 7); // bottom-left
  m.ret(); // 3336  ret
}
