// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_1da6  (ROM 0x1DA6–0x1DBC) — PLAYER sprite -> display buffer copy.
 * The convergence tail of entry_1ac3 (11 jp/call sites). Copies player fields
 * (0x6203,0x6207,0x6208,0x6205) = player(+3,+7,+8,+5) -- OUT OF ORDER, do not
 * sort -- to the buffer 0x694C..0x694F. The player-hardcoded twin of loc_21ba.
 * Translated for completeness; not yet wired into the live dispatcher.
 *   1da6  ld hl,0x694c
 *   1da9  ld a,(0x6203) / ld (hl),a
 *   1dad  ld a,(0x6207) / inc l / ld (hl),a
 *   1db2  ld a,(0x6208) / inc l / ld (hl),a
 *   1db7  ld a,(0x6205) / inc l / ld (hl),a
 *   1dbc  ret
 */
export function entry_1da6(m) {
  const { regs, mem } = m;
  regs.hl = 0x694c;
  m.step(0x1da9, 10);
  regs.a = mem.read8(0x6203); mem.write8(regs.hl, regs.a);
  m.step(0x1dad, 13 + 7);
  regs.a = mem.read8(0x6207); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
  m.step(0x1db2, 13 + 4 + 7);
  regs.a = mem.read8(0x6208); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
  m.step(0x1db7, 13 + 4 + 7);
  regs.a = mem.read8(0x6205); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
  m.step(0x1dbc, 13 + 4 + 7);
  m.ret(10);
}
