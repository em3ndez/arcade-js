// SPDX-License-Identifier: GPL-3.0-only
// loc_08f1  (ROM 0x08f1-0x08f2) -- reached by `jmp 0x08f1` at 0x0739. Seeds C=0x03 (a 3-entry
// count) then falls through into loc_08f3 (its own entry, the widely-called sprite-list driver),
// so it delegates rather than inlining across the boundary.
export function loc_08f1(m) {
  const { regs } = m;

  regs.c = 0x03; m.step(0x08f3, 7); // 08f1  mvi c,0x03
  return m.call(0x08f3); // 08f3  fall through into loc_08f3 (its own entry)
}
