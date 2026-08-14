// SPDX-License-Identifier: GPL-3.0-only

// loc_27b3  (ROM 0x27B3-0x27CA) — collision-flag reset. Guarded by (0x8135): if 0, ret; otherwise
// clear (0x8134) and fall through into loc_27bc. loc_27bc (0x27BC-0x27CA) is a second entry, called
// directly by the goal-scoring routine: it zeroes 0x8040-0x8043 and (0x8135).
export function loc_27b3(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8135);
  m.step(0x27b6, 13); // ld a,(0x8135)
  regs.and(regs.a);
  m.step(0x27b7, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z -- nothing to reset
    return;
  }
  m.step(0x27b8, 5);
  regs.xor(regs.a);
  m.step(0x27b9, 4); // xor a -- A = 0
  mem.write8(0x8134, regs.a);
  m.step(0x27bc, 13); // ld (0x8134),0 -- falls through to 0x27bc
  return m.call(0x27bc);
}

export function loc_27bc(m) {
  const { regs, mem } = m;

  regs.hl = 0x8040;
  m.step(0x27bf, 10); // ld hl,0x8040
  regs.xor(regs.a);
  m.step(0x27c0, 4); // xor a
  mem.write8(regs.hl, regs.a);
  m.step(0x27c1, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27c2, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x27c3, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27c4, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x27c5, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27c6, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x27c7, 7); // 0x8040-0x8043 = 0
  mem.write8(0x8135, regs.a);
  m.step(0x27ca, 13); // ld (0x8135),0
  m.ret();
}
