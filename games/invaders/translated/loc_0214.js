// SPDX-License-Identifier: GPL-3.0-only
// loc_0214  (ROM 0x0214-0x0219) -- reached from loc_020e (jmp) and loc_0213 (fall-through).
// Seeds DE=0x2242, then tail-jumps to the shared draw body loc_021e.
export function loc_0214(m) {
  const { regs } = m;

  regs.de = 0x2242; m.step(0x0217, 10); // 0214  lxi d,0x2242
  m.step(0x021e, 10); return m.call(0x021e); // 0217  jmp 0x021e (tail)
}
