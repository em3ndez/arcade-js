// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3e01  (ROM 0x3E01–0x3E12) — fills a column of B cells: writes the byte at
 * 0x8057 into (0x805e), (0x805e)+0x20, (0x805e)+0x40, … for B = (0x8055) rows.
 *
 *   3e01  2a 5e 80     ld   hl,(0x805e)   ; column base pointer
 *   3e04  11 20 00     ld   de,0x0020     ; stride: one row down the column
 *   3e07  3a 55 80     ld   a,(0x8055)
 *   3e0a  47           ld   b,a           ; row count -> B (djnz)
 *   3e0b  3a 57 80     ld   a,(0x8057)    ; the fill byte
 *
 *   3e0e  77           ld   (hl),a        ; loc_3e0e -- the djnz loop body
 *   3e0f  19           add  hl,de
 *   3e10  10 fc        djnz 0x3e0e
 *   3e12  c9           ret
 *
 * WHAT IT DOES: writes one byte down a column of B rows, stride 0x20 (32) — the
 * one-row step of this hardware's column-major tilemap/colour RAM. The base
 * pointer is loaded INDIRECTLY from the 16-bit word at 0x805e (`ld hl,(nn)`, not
 * `ld hl,nn`); the count comes from 0x8055 and the tile from 0x8057.
 *
 * `add hl,de` writes H, N and C (S/Z/PV preserved). Its carry-out survives the
 * flagless `djnz` and the `ret` to reach the caller, so regs.addHl is required
 * rather than a bare 16-bit add — the sub_003d / sub_11d3 shape.
 *
 * B IS NOT CHECKED FOR ZERO. `djnz` decrements then tests, so B = 0 on entry
 * runs 256 iterations (the count wraps 0x00 -> 0xff before the first test). That
 * is the real Z80 behaviour and is reproduced, not guarded; every caller loads a
 * nonzero count into 0x8055.
 */
export function loc_3e01(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x805e); // ld hl,(0x805e) -- INDIRECT: base pointer word
  m.step(0x3e04, 16);
  regs.de = 0x0020; // ld de,0x0020 -- one row down the column
  m.step(0x3e07, 10);
  regs.a = mem.read8(0x8055); // ld a,(0x8055) -- row count
  m.step(0x3e0a, 13);
  regs.b = regs.a; // ld b,a
  m.step(0x3e0b, 4);
  regs.a = mem.read8(0x8057); // ld a,(0x8057) -- the fill byte
  m.step(0x3e0e, 13);

  do {
    // loc_3e0e -- djnz targets here; write the byte, advance one row down.
    mem.write8(regs.hl, regs.a); // ld (hl),a
    m.step(0x3e0f, 7);
    regs.addHl(regs.de); // add hl,de -- writes H,N,C; the final carry escapes
    m.step(0x3e10, 11);
    regs.djnz(); // dec b, no flags (that is why it is NOT dec8)
    m.step(regs.b !== 0 ? 0x3e0e : 0x3e12, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 3e12
}
