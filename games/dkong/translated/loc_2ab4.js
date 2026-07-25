// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2ab4  (ROM 0x2AB4–0x2ACC) — the slope cascade off sub_2a85.
 * Reached when Mario's foot-probe tile is a SLOPE (tile < 0xB0, or low-nibble >= 8).
 * Probe the tile ONE ROW UP (HL -= 0x20): if that upper tile is solid (>= 0xB0 and
 * low-nibble < 8) fall through to a bare ret; otherwise (X&7==0, or upper tile is
 * also slope/empty) set the slope-contact flag 0x6221 via entry_2acd. Transcribed
 * from out/dk.asm so Mario can stand on the angled girders (was a NotImplemented
 * frontier -- found by poke-sweeping Mario's Y up the board).
 *   2ab4 7a ld a,d   2ab5 e6 07 and 0x07   2ab7 ca cd 2a jp z,0x2acd
 *   2aba 01 20 00 ld bc,0x0020   2abd ed 42 sbc hl,bc   2abf 7e ld a,(hl)
 *   2ac0 fe b0 cp 0xb0   2ac2 da cd 2a jp c,0x2acd   2ac5 e6 0f and 0x0f
 *   2ac7 fe 08 cp 0x08   2ac9 d2 cd 2a jp nc,0x2acd   2acc c9 ret
 */
export function loc_2ab4(m) {
  const { regs, mem } = m;
  regs.a = regs.d;
  m.step(0x2ab5, 4); // ld a,d
  regs.and(0x07);
  m.step(0x2ab7, 7); // and 0x07 (also clears carry for the sbc below)
  if (regs.fZ) { m.step(0x2acd, 10); return m.call(0x2acd); } // jp z,0x2acd
  m.step(0x2aba, 10); // jp z not taken
  regs.bc = 0x0020;
  m.step(0x2abd, 10); // ld bc,0x0020
  regs.sbcHl(regs.bc); // sbc hl,bc -- carry 0 from `and`, HL -= 0x20 (one tile row up)
  m.step(0x2abf, 15); // sbc hl,bc
  regs.a = mem.read8(regs.hl);
  m.step(0x2ac0, 7); // ld a,(hl)
  regs.cp(0xb0);
  m.step(0x2ac2, 7); // cp 0xb0
  if (regs.fC) { m.step(0x2acd, 10); return m.call(0x2acd); } // jp c,0x2acd
  m.step(0x2ac5, 10); // jp c not taken
  regs.and(0x0f);
  m.step(0x2ac7, 7); // and 0x0f
  regs.cp(0x08);
  m.step(0x2ac9, 7); // cp 0x08
  if (regs.fNC) { m.step(0x2acd, 10); return m.call(0x2acd); } // jp nc,0x2acd
  m.step(0x2acc, 10); // jp nc not taken
  m.ret(); // 0x2ACC c9 ret
}
