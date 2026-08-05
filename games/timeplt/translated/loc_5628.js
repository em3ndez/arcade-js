// SPDX-License-Identifier: GPL-3.0-only

// loc_5628  (ROM 0x5628-0x5629) — its own prologue, then falls into 0x562A, which owns the body.
export function loc_5628(m) {
  const { regs } = m;

  m.push16(regs.hl);
  m.step(0x5629, 11); // 5628  push hl
  m.push16(regs.af);
  m.step(0x562a, 11); // 5629  push af

  return m.call(0x562a);
}
