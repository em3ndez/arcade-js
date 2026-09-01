// SPDX-License-Identifier: GPL-3.0-only
// loc_0798  (ROM 0x0798-0x079a) -- reached by `jc 0x0798` at 0x0867 and fallen into from
// loc_077f. Sets B=0x99 (BCD -1) and clears A, then falls through into loc_079b (its own head).
export function loc_0798(m) {
  const { regs } = m;

  regs.b = 0x99; m.step(0x079a, 7);    // 0798  mvi b,0x99
  regs.xor(regs.a); m.step(0x079b, 4); // 079a  xra a
  return m.call(0x079b);               // 079b  fall through into loc_079b
}
