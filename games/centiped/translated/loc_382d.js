// SPDX-License-Identifier: GPL-3.0-only
// loc_382d  (ROM 0x382d-0x3833) -- two's-complement negate of A (EOR #$FF, CLC, ADC #$01); RTS.
export function loc_382d(m) {
  const { regs } = m;
  regs.eor(0xff); m.step(0x382f, 2);  // 382d eor #$ff
  regs.clc(); m.step(0x3830, 2);      // 382f clc
  regs.adc(0x01); m.step(0x3832, 2);  // 3830 adc #$01
  return m.ret(6);                    // 3832 rts
}
