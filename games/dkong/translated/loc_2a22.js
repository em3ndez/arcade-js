// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2a22  (ROM 0x2A22–0x2A2E) — entry_2913 wrapper: B=6, DE=0x0010, IX=0x6600.
 *
 *   2a22  06 06        ld   b,0x06
 *   2a24  11 10 00     ld   de,0x0010
 *   2a27  dd 21 00 66  ld   ix,0x6600
 *   2a2b  cd 13 29     call 0x2913
 *   2a2e  c9           ret                ; runs ONLY on entry_2913's A=0 exit
 */
export function loc_2a22(m) {
  const { regs } = m;

  regs.b = 0x06;
  m.step(0x2a24, 7); // ld b,0x06
  regs.de = 0x0010;
  m.step(0x2a27, 10); // ld de,0x0010
  regs.ix = 0x6600;
  m.step(0x2a2b, 14); // ld ix,0x6600

  m.push16(0x2a2e); // call 0x2913 pushes the return address 0x2A2E
  m.step(0x2913, 17);
  if (!m.call(0x2913)) {
    // A=1: entry_2913 discarded 0x2A2E and already returned to OUR caller
    // (0x29C0). Executing the ret below would double-return.
    return;
  }
  m.ret(); // ret (0x2A2E) -- only on entry_2913's A=0 (normal) exit
}
