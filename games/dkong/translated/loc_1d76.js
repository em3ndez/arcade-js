// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1d76  (ROM 0x1D76–0x1D89) — timer-running branch: 0x621A gates; falls into the shared tail entry_1d8a.
 */
export function loc_1d76(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x621a);
  m.step(0x1d79, 13); // ld a,(0x621a)
  regs.and(regs.a);
  m.step(0x1d7a, 4); // and a
  if (regs.fZ) { m.step(0x1d8a, 10); return m.call(0x1d8a); } // jp z,0x1d8a -> shared tail
  m.step(0x1d7d, 10); // (0x621A) != 0  [COLD arm on tape]
  mem.write8(0x6219, regs.a);
  m.step(0x1d80, 13); // ld (0x6219),a := (0x621A)
  regs.a = mem.read8(0x621c);
  m.step(0x1d83, 13); // ld a,(0x621c)
  regs.sub(0x13);
  m.step(0x1d85, 7); // sub 0x13
  regs.hl = 0x6205;
  m.step(0x1d88, 10); // ld hl,0x6205
  regs.cp(mem.read8(regs.hl));
  m.step(0x1d89, 7); // cp (hl)
  if (regs.fNC) { m.ret(11); return; } // ret nc
  m.step(0x1d8a, 5); // ret nc NOT taken -> FALL INTO entry_1d8a
  return m.call(0x1d8a);
}
