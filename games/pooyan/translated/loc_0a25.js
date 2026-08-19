// SPDX-License-Identifier: GPL-3.0-only

// loc_0a25  (ROM 0x0a25-0x0a27) -- loads HL = 0x8d41 then falls straight through into loc_0a28.
// The fall-through is a tail hand-off: loc_0a28 (via loc_0a40) rets to loc_0a25's own caller,
// so nothing is pushed here -> `return m.call(0x0a28)`.
export function loc_0a25(m) {
  const { regs } = m;

  regs.hl = 0x8d41;
  m.step(0x0a28, 10); // 0a25  ld hl,0x8d41 -> falls through to loc_0a28
  return m.call(0x0a28);
}
