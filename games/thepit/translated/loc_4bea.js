// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4bea  (ROM 0x4BEA–0x4BFE) — zeroes two work-RAM blocks: a 6-byte block at
 * 0x8031–0x8036, then a 10-byte block at 0x801E–0x8027. Two textbook `djnz`
 * fill loops back to back; no A, no calls, no flags.
 *
 *   4bea  06 06        ld   b,0x06
 *   4bec  21 31 80     ld   hl,0x8031
 * loc_4bef:
 *   4bef  36 00        ld   (hl),0x00
 *   4bf1  23           inc  hl
 *   4bf2  10 fb        djnz 0x4bef        ; clear 0x8031..0x8036 (6 bytes)
 *   4bf4  06 0a        ld   b,0x0a
 *   4bf6  21 1e 80     ld   hl,0x801e
 * loc_4bf9:
 *   4bf9  36 00        ld   (hl),0x00
 *   4bfb  23           inc  hl
 *   4bfc  10 fb        djnz 0x4bf9        ; clear 0x801E..0x8027 (10 bytes)
 *   4bfe  c9           ret
 *
 * NO FLAGS ARE TOUCHED end to end: `ld r,n`, `ld (hl),n`, `inc hl` (16-bit) and
 * `djnz` all leave F alone, so the flags at `ret` are exactly the caller's at
 * entry. B drains to 0; HL ends at 0x8028 (0x801E + 10, one past the last
 * cleared cell). A is never referenced. The two `inc hl` writes advance BEFORE
 * the djnz test, so the blocks cleared are 0x8031.. and 0x801E.. inclusive of
 * the start and exclusive of HL's final value.
 */
export function loc_4bea(m) {
  const { regs, mem } = m;

  regs.b = 0x06;
  m.step(0x4bec, 7); // ld b,0x06 -- first block count
  regs.hl = 0x8031;
  m.step(0x4bef, 10); // ld hl,0x8031 -- first block base

  for (;;) {
    // loc_4bef
    mem.write8(regs.hl, 0x00); // ld (hl),0x00
    m.step(0x4bf1, 10);
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl -- 16-bit inc, no flags
    m.step(0x4bf2, 6);
    // djnz 0x4bef -- B--, loop while non-zero (no flags)
    if (regs.djnz() !== 0) {
      m.step(0x4bef, 13); // djnz taken -> loc_4bef
    } else {
      m.step(0x4bf4, 8); // djnz not taken -> fall through
      break;
    }
  }

  regs.b = 0x0a;
  m.step(0x4bf6, 7); // ld b,0x0a -- second block count
  regs.hl = 0x801e;
  m.step(0x4bf9, 10); // ld hl,0x801e -- second block base

  for (;;) {
    // loc_4bf9
    mem.write8(regs.hl, 0x00); // ld (hl),0x00
    m.step(0x4bfb, 10);
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl -- 16-bit inc, no flags
    m.step(0x4bfc, 6);
    // djnz 0x4bf9 -- B--, loop while non-zero (no flags)
    if (regs.djnz() !== 0) {
      m.step(0x4bf9, 13); // djnz taken -> loc_4bf9
    } else {
      m.step(0x4bfe, 8); // djnz not taken -> fall through
      break;
    }
  }

  m.ret(); // 4bfe  ret
}
