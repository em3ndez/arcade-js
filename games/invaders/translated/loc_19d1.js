// SPDX-License-Identifier: GPL-3.0-only
// loc_19d1  (ROM 0x19d1-0x19d2) -- loads A:=1 then falls through into loc_19d3 (its own entry,
// also the tail-jump target of loc_19d7), so it delegates rather than inlining across the boundary.
export function loc_19d1(m) {
  m.regs.a = 0x01; m.step(0x19d3, 7); // 19d1  mvi a,0x01
  return m.call(0x19d3);              // 19d3  fall through into loc_19d3
}
