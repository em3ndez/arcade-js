// SPDX-License-Identifier: GPL-3.0-only
// loc_021a  (ROM 0x021a) -- `call 0x021a` entry. Clears A (xra a), then falls through into
// loc_021b (DE=0x2142 arm of the shared draw body at loc_021e).
export function loc_021a(m) {
  const { regs } = m;

  regs.xor(regs.a); m.step(0x021b, 4); // 021a  xra a
  return m.call(0x021b); // fall through into loc_021b
}
