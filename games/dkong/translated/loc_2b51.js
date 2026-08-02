// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2b51  (ROM 0x2B51–0x2B52) — pop hl / ret: SKIP past entry_2b1c (discard 2b29's return, ret to 2b1c's caller).
 */
export function loc_2b51(m) {
  const { regs } = m;
  regs.hl = m.pop16();
  m.step(0x2b52, 10); // pop hl -- discard 2b29's return
  m.ret(); // ret -- to 2b1c's caller
  return false;
}
