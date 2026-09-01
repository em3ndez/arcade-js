// SPDX-License-Identifier: GPL-3.0-only
// loc_19d3  (ROM 0x19d3-0x19d6) -- shared tail: stores A at 0x20e9, returns. Entered by fall-through
// from loc_19d1 (A=1) and by `jmp 0x19d3` from loc_19d7 (A=0).
export function loc_19d3(m) {
  const { regs, mem } = m;
  mem.write8(0x20e9, regs.a); m.step(0x19d6, 13); // 19d3  sta 0x20e9
  return m.ret(10);                                // 19d6  ret
}
