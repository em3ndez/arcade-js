// SPDX-License-Identifier: GPL-3.0-only
// loc_19d7  (ROM 0x19d7-0x19da) -- clears A then tail-jumps to loc_19d3 (which stores A at 0x20e9).
export function loc_19d7(m) {
  const { regs } = m;
  regs.xor(regs.a); m.step(0x19d8, 4);       // 19d7  xra a
  m.step(0x19d3, 10); return m.call(0x19d3); // 19d8  jmp 0x19d3
}
