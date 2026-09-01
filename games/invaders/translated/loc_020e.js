// SPDX-License-Identifier: GPL-3.0-only
// loc_020e  (ROM 0x020e-0x0212) -- `call 0x020e` entry. Sets A=0x01, then tail-jumps to loc_0214
// (the DE=0x2242 arm of the shared draw body at loc_021e).
export function loc_020e(m) {
  const { regs } = m;

  regs.a = 0x01; m.step(0x0210, 7); // 020e  mvi a,0x01
  m.step(0x0214, 10); return m.call(0x0214); // 0210  jmp 0x0214 (tail)
}
