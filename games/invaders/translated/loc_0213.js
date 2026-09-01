// SPDX-License-Identifier: GPL-3.0-only
// loc_0213  (ROM 0x0213) -- `call 0x0213` entry. Clears A (xra a), then falls through into
// loc_0214 (DE=0x2242 arm of the shared draw body at loc_021e).
export function loc_0213(m) {
  const { regs } = m;

  regs.xor(regs.a); m.step(0x0214, 4); // 0213  xra a
  return m.call(0x0214); // fall through into loc_0214
}
