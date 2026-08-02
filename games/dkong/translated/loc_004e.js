// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_004e  (ROM 0x004E–0x0056).
 *
 *   004e  11 08 69     ld   de,0x6908
 *   0051  01 28 00     ld   bc,0x0028
 *   0054  ed b0        ldir
 *   0056  c9           ret
 *
 * Copies 0x28 = 40 bytes to 0x6908-0x692F.
 *
 * HL IS AN IMPLICIT INPUT. This routine sets DE and BC and does NOT set HL,
 * so the SOURCE of the copy is supplied entirely by the caller -- and there
 * are thirteen callers. The source address is not determinable from these nine
 * bytes.
 *
 * Returns normally: one unconditional `ret`, stack balanced, no conditional
 * return and no tail jump.
 *
 * On exit LDIR leaves BC=0, DE=0x6930, HL=HL_in+0x28, and PRESERVES CARRY --
 * all four are visible to the caller.
 */
export function loc_004e(m) {
  const { regs } = m;

  regs.de = 0x6908;
  m.step(0x0051, 10);
  regs.bc = 0x0028;
  m.step(0x0054, 10);

  // Reads through HL, which this routine never sets.
  // LdirAt, NOT the 0x01CF-hardcoded ldir().
  m.ldirAt(0x0054, 0x0056);

  m.ret(); // 0056 -- unconditional, 10 T
}
