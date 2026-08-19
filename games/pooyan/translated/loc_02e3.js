// SPDX-License-Identifier: GPL-3.0-only

// loc_02e3  (ROM 0x02e3-0x02e5) -- sets HL=0x8402 then falls through into
// loc_02e6 (its own routine entry), so this is the "reset pointer to 0x8402"
// variant. The fall-through is a tail-delegate to the 0x02e6 boundary.
export function loc_02e3(m) {
  const { regs } = m;

  regs.hl = 0x8402;
  m.step(0x02e6, 10); // 02e3  ld hl,0x8402
  return m.call(0x02e6); // fall through into loc_02e6
}
