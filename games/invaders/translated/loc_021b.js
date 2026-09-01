// SPDX-License-Identifier: GPL-3.0-only
// loc_021b  (ROM 0x021b-0x021d) -- reached from loc_0209 (jmp) and loc_021a (fall-through).
// Seeds DE=0x2142, then falls through into the shared draw body loc_021e (its own head).
export function loc_021b(m) {
  const { regs } = m;

  regs.de = 0x2142; m.step(0x021e, 10); // 021b  lxi d,0x2142
  return m.call(0x021e); // fall through into loc_021e
}
