// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e85  (ROM 0x1E85–0x1E8B) — 1E57 interior: 0x600A=0x16, then UNWIND (pop own return, ret to caller's caller).
 */
export function loc_1e85(m) {
  const { regs, mem } = m;
  regs.a = 0x16;
  m.step(0x1e87, 7); // ld a,0x16
  mem.write8(0x600a, regs.a); // 0x600A = 0x16
  m.step(0x1e8a, 13);
  regs.hl = m.pop16(); // pop hl -- discards sub_1e57's OWN return address
  m.step(0x1e8b, 10);
  m.ret(); // returns to the CALLER'S CALLER -- unwinds
  return false; // BOOLEAN: unwound (the caller must not continue)
}
