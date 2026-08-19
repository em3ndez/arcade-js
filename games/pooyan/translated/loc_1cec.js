// SPDX-License-Identifier: GPL-3.0-only

// loc_1cec  (ROM 0x1cec-0x1cf5) -- with HL supplied by the caller, walk backwards two rows
// (DE = -0x20 = 0xffe0) writing tile 0x25 then 0x20. Entered by fall-through from loc_1ce7
// (HL=0x84e0) and by `jr 0x1cec` at 0x1d12 (HL=0x8740). HL is an input register.
export function loc_1cec(m) {
  const { regs, mem } = m;

  regs.de = 0xffe0;             m.step(0x1cef, 10); // 1cec  ld de,0xffe0
  regs.addHl(regs.de);          m.step(0x1cf0, 11); // 1cef  add hl,de
  mem.write8(regs.hl, 0x25);    m.step(0x1cf2, 10); // 1cf0  ld (hl),0x25
  regs.addHl(regs.de);          m.step(0x1cf3, 11); // 1cf2  add hl,de
  mem.write8(regs.hl, 0x20);    m.step(0x1cf5, 10); // 1cf3  ld (hl),0x20
  return m.ret();               // 1cf5  ret
}
