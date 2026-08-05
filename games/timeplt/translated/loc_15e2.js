// SPDX-License-Identifier: GPL-3.0-only

// loc_15e2  (ROM 0x15E2-0x15FD)
export function loc_15e2(m) {
  const { regs, mem } = m;

  m.push16(0x15e5);
  m.step(0x019a, 17); // call 0x019a
  m.call(0x019a);

  regs.a = mem.read8(0x1749);
  m.step(0x15e8, 13); // ld a,(0x1749) -- a ROM constant
  mem.write8(0xa9ac, regs.a);
  m.step(0x15eb, 13); // ld (0xa9ac),a -- the index loc_0f1f masks and dispatches on
  regs.c = 0x00;
  m.step(0x15ed, 7); // ld c,0x00 -- 256 iterations, not zero
  regs.hl = 0x5648;
  m.step(0x15f0, 10); // ld hl,0x5648
  regs.a = mem.read8(0xa9ab);
  m.step(0x15f3, 13); // ld a,(0xa9ab)

  for (;;) {
    regs.sub(mem.read8(regs.hl));
    m.step(0x15f4, 7); // sub (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x15f5, 6); // inc hl
    regs.c = regs.dec8(regs.c);
    m.step(0x15f6, 4); // dec c
    if (regs.fNZ) {
      m.step(0x15f3, 12); // jr nz,0x15f3 taken
      continue;
    }
    m.step(0x15f8, 7); // jr nz not taken
    break;
  }

  regs.xor(0x4e);
  m.step(0x15fa, 7); // xor 0x4e
  mem.write8(0xa9ab, regs.a);
  m.step(0x15fd, 13); // ld (0xa9ab),a -- the running total, folded with 0x4e

  m.ret(10); // ret -- pops the 0x0174 loc_00d8 pushed: the NMI epilogue
}
