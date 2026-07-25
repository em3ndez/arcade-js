// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1f8d  (ROM 0x1F8D–0x1F92) — 4th inc l + loop advance. SHARED ENTRY from loc_21ba.
 *  (0x21CE jp 0x1f8d) -- the SCC continuation.
 */
export function loc_1f8d(m) {
  const { regs } = m;
  regs.l = regs.inc8(regs.l);
  m.step(0x1f8e, 4); // inc l (4th; 0x1F8D external entry lands here)
  regs.addIx(regs.de);
  m.step(0x1f90, 15); // add ix,de
  regs.b = (regs.b - 1) & 0xff; // djnz -- no flags
  if (regs.b !== 0) { m.step(0x1f83, 13); return m.call(0x1f83); } // djnz 0x1f83 taken
  m.step(0x1f92, 8); // djnz NOT taken
  m.ret(10); // 0x1F92
}
