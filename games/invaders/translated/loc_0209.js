// SPDX-License-Identifier: GPL-3.0-only
// loc_0209  (ROM 0x0209-0x020d) -- `call 0x0209` entry. Sets A=0x01, then tail-jumps to loc_021b
// (the DE=0x2142 arm of the shared draw body at loc_021e).
export function loc_0209(m) {
  const { regs } = m;

  regs.a = 0x01; m.step(0x020b, 7); // 0209  mvi a,0x01
  m.step(0x021b, 10); return m.call(0x021b); // 020b  jmp 0x021b (tail)
}
