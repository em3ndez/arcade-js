// SPDX-License-Identifier: GPL-3.0-only
//
// loc_3307  (ROM 0x3307-0x3324) -- copy a 3-tile column three times: for each of three rows it copies
// 3 source bytes (DE) into video RAM (HL), then advances HL by 0x1d (so the column steps down 0x20
// cells per row). Uses the (0x8f0b) row counter, resetting it to 0 on completion. Called from
// loc_25a6 / loc_26b3 and other blitters with HL = video cell, DE = source tiles.
export function loc_3307(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.bc = 0x001d; m.step(0x330a, 10);
    m.push16(regs.bc); m.step(0x330b, 11);
    regs.b = 0x03; m.step(0x330d, 7);
    for (;;) {
      regs.a = mem.read8(regs.de); m.step(0x330e, 7); // 330d  ld a,(de)
      mem.write8(regs.hl, regs.a); m.step(0x330f, 7); // 330e  ld (hl),a
      regs.de = (regs.de + 1) & 0xffff; m.step(0x3310, 6);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3311, 6);
      if (regs.djnz() !== 0) { m.step(0x330d, 13); continue; }
      m.step(0x3313, 8); break;
    }
    regs.bc = m.pop16(); m.step(0x3314, 10);
    regs.addHl(regs.bc); m.step(0x3315, 11); // 3314  add hl,bc (HL += 0x1d)
    regs.a = mem.read8(0x8f0b); m.step(0x3318, 13); // 3315  ld a,(0x8f0b)
    regs.a = regs.inc8(regs.a); m.step(0x3319, 4);
    mem.write8(0x8f0b, regs.a); m.step(0x331c, 13); // 3319  ld (0x8f0b),a
    regs.cp(0x03); m.step(0x331e, 7);
    if (regs.fNZ) { m.step(0x3307, 12); continue; }
    m.step(0x3320, 7); break;
  }
  regs.xor(regs.a); m.step(0x3321, 4);
  mem.write8(0x8f0b, regs.a); m.step(0x3324, 13); // 3321  ld (0x8f0b),a
  m.ret();
}
