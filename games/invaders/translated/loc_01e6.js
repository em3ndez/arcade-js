// SPDX-License-Identifier: GPL-3.0-only
// loc_01e6  (ROM 0x01e6-0x01ee) -- BOOT-INIT step, `call 0x01e6` from loc_18d4 (the boot gap).
// Seeds DE=0x1b00 / HL=0x2000, then tail-jumps into loc_1a32 (delegates, does not inline).
export function loc_01e6(m) {
  const { regs } = m;

  regs.de = 0x1b00; m.step(0x01e9, 10); // 01e6  lxi d,0x1b00
  regs.hl = 0x2000; m.step(0x01ec, 10); // 01e9  lxi h,0x2000
  m.step(0x1a32, 10); return m.call(0x1a32); // 01ec  jmp 0x1a32 (tail)
}
