// SPDX-License-Identifier: GPL-3.0-only
// loc_066c  (ROM 0x066c-0x0674) -- CALLed from 0x05f0 and tail-jumped from 0x0664. Points HL at
// 0x2079, calls 0x1a3b, then tail-jumps loc_1491 (delegate).
export function loc_066c(m) {
  const { regs } = m;

  regs.hl = 0x2079; m.step(0x066f, 10);                 // 066c  lxi h,0x2079
  m.push16(0x0672); m.step(0x1a3b, 17); m.call(0x1a3b); // 066f  call 0x1a3b
  m.step(0x1491, 10); return m.call(0x1491);            // 0672  jmp 0x1491 (delegate)
}
