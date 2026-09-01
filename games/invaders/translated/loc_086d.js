// SPDX-License-Identifier: GPL-3.0-only
// loc_086d  (ROM 0x086d-0x0871) -- reached by loc_0857's `jc 0x086d`. Sets A=0x01 then tail-jumps
// to 0x079b.
export function loc_086d(m) {
  const { regs } = m;

  regs.a = 0x01; m.step(0x086f, 7); // 086d  mvi a,0x01
  m.step(0x079b, 10); return m.call(0x079b); // 086f  jmp 0x079b (tail)
}
