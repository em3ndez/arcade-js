// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1a1f  (ROM 0x1A1F–0x1A29) — idx2 DELAY: countdown (0x6387); at 0 advance state to 3.
 */
export function loc_1a1f(m) {
  const { regs, mem } = m;
  regs.hl = 0x6387;
  m.step(0x1a22, 10); // ld hl,0x6387
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x1a23, 11); // dec (hl) -- (0x6387)--
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- stay in state 2
  m.step(0x1a24, 5); // ret nz NOT taken
  regs.a = 0x03;
  m.step(0x1a26, 7); // ld a,0x03
  mem.write8(0x6386, regs.a);
  m.step(0x1a29, 13); // ld (0x6386),a -- state := 3
  m.ret(10); // ret -> loc_197a
}
