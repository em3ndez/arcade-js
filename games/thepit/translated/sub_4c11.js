// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_4c11  (ROM 0x4C11–0x4C1B) — clears 128 bytes of attribute/sprite RAM
 * (0x9800–0x987F) to zero.
 *
 *   4c11  06 80        ld   b,0x80        ; 128 bytes to clear
 *   4c13  21 00 98     ld   hl,0x9800     ; attribute / sprite RAM base
 *
 *   ---- loc_4c16 : the djnz clear loop ----
 *   4c16  36 00        ld   (hl),0x00     ; zero one byte
 *   4c18  2c           inc  l             ; next byte, WITHIN page 0x98
 *   4c19  10 fb        djnz 0x4c16
 *   4c1b  c9           ret
 *
 * WHAT IT DOES: writes 0x00 into 0x9800..0x987F — the attribute/column-scroll
 * RAM (0x9800-0x983F), sprite RAM (0x9840-0x985F) and the first spare bytes
 * (0x9860-0x987F) — a init-time wipe of the 0x9800 block's low half.
 *
 * `inc l` (0x2c), NOT `inc hl`: only L advances, so the pointer can never leave
 * page 0x98. With B = 0x80 and L starting at 0x00, L runs 0x00..0x7F and the
 * 128th `inc l` lands it on 0x80 (no wrap), so HL exits at 0x9880 — the first
 * byte the loop does NOT touch. `inc l` sets S/Z/H/PV (carry preserved via
 * regs.inc8), but nothing reads those flags: the flagless `djnz` counts B down
 * without touching them and the `ret` follows, so they are dead residue.
 *
 * B IS THE FIXED IMMEDIATE 0x80, not read from RAM, so the loop always runs
 * exactly 128 times.
 */
export function sub_4c11(m) {
  const { regs, mem } = m;

  regs.b = 0x80; // ld b,0x80 -- 128 bytes
  m.step(0x4c13, 7);
  regs.hl = 0x9800; // ld hl,0x9800 -- attribute/sprite RAM base
  m.step(0x4c16, 10);

  do {
    // loc_4c16 -- djnz targets here; zero one byte, step L within page 0x98.
    mem.write8(regs.hl, 0x00); // ld (hl),0x00
    m.step(0x4c18, 10);
    regs.l = regs.inc8(regs.l); // inc l -- L++ (carry preserved); stays in page 0x98
    m.step(0x4c19, 4);
    regs.djnz(); // dec b, no flags (that is why it is NOT dec8)
    m.step(regs.b !== 0 ? 0x4c16 : 0x4c1b, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 4c1b
}
