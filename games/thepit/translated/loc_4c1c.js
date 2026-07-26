// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c1c  (ROM 0x4C1C–0x4C26) — clears 64 bytes of work RAM
 * (0x8200–0x823F) to zero.
 *
 *   4c1c  06 40        ld   b,0x40        ; 64 bytes to clear
 *   4c1e  21 00 82     ld   hl,0x8200     ; work-RAM destination base
 *
 *   ---- loc_4c21 : the djnz clear loop ----
 *   4c21  36 00        ld   (hl),0x00     ; zero one byte
 *   4c23  2c           inc  l             ; next byte, WITHIN page 0x82
 *   4c24  10 fb        djnz 0x4c21
 *   4c26  c9           ret
 *
 * WHAT IT DOES: writes 0x00 into 0x8200..0x823F — a 64-byte span of work RAM
 * (0x8000-0x87FF) — an init-time wipe of that block. Sibling of loc_4c11, which
 * runs the identical loop over 128 bytes of the 0x9800 attribute/sprite block.
 *
 * `inc l` (0x2c), NOT `inc hl`: only L advances, so the pointer can never leave
 * page 0x82. With B = 0x40 and L starting at 0x00, L runs 0x00..0x3F and the
 * 64th `inc l` lands it on 0x40 (no wrap), so HL exits at 0x8240 — the first
 * byte the loop does NOT touch. `inc l` sets S/Z/H/PV (carry preserved via
 * regs.inc8), but nothing reads those flags: the flagless `djnz` counts B down
 * without touching them and the `ret` follows, so they are dead residue.
 *
 * B IS THE FIXED IMMEDIATE 0x40, not read from RAM, so the loop always runs
 * exactly 64 times.
 */
export function loc_4c1c(m) {
  const { regs, mem } = m;

  regs.b = 0x40; // ld b,0x40 -- 64 bytes
  m.step(0x4c1e, 7);
  regs.hl = 0x8200; // ld hl,0x8200 -- work-RAM destination base
  m.step(0x4c21, 10);

  do {
    // loc_4c21 -- djnz targets here; zero one byte, step L within page 0x82.
    mem.write8(regs.hl, 0x00); // ld (hl),0x00
    m.step(0x4c23, 10);
    regs.l = regs.inc8(regs.l); // inc l -- L++ (carry preserved); stays in page 0x82
    m.step(0x4c24, 4);
    regs.djnz(); // dec b, no flags (that is why it is NOT dec8)
    m.step(regs.b !== 0 ? 0x4c21 : 0x4c26, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 4c26
}
