// SPDX-License-Identifier: GPL-3.0-only
// loc_0675  (ROM 0x0675-0x067d) -- CALLed from 0x05d1/0x064e and tail-jumped from 0x0669. Points HL
// at 0x2079, calls 0x1a3b, then tail-jumps loc_1452 (delegate).
export function loc_0675(m) {
  const { regs } = m;

  regs.hl = 0x2079; m.step(0x0678, 10);                 // 0675  lxi h,0x2079
  m.push16(0x067b); m.step(0x1a3b, 17); m.call(0x1a3b); // 0678  call 0x1a3b
  m.step(0x1452, 10); return m.call(0x1452);            // 067b  jmp 0x1452 (delegate)
}
