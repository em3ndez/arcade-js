// SPDX-License-Identifier: GPL-3.0-only
// loc_384f  (ROM 0x384f-0x385c) -- prints A as two BCD digits: saves A/flags, high nibble (A>>4)
// through $385c, restores A, low nibble AND $0f, then falls through into loc_385c.
export function loc_384f(m) {
  const { regs } = m;
  m.push8(regs.a); m.step(0x3850, 3);                        // 384f pha
  m.push8(regs.p); m.step(0x3851, 3);                        // 3850 php
  regs.a = regs.lsr(regs.a); m.step(0x3852, 2);              // 3851 lsr a
  regs.a = regs.lsr(regs.a); m.step(0x3853, 2);              // 3852 lsr a
  regs.a = regs.lsr(regs.a); m.step(0x3854, 2);              // 3853 lsr a
  regs.a = regs.lsr(regs.a); m.step(0x3855, 2);              // 3854 lsr a
  regs.p = m.pull8(); m.step(0x3856, 4);                     // 3855 plp
  m.push16(0x3858); m.step(0x3859, 6); m.call(0x385c);                         // 3856 jsr $385c
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x385a, 4); // 3859 pla
  regs.and(0x0f); m.step(0x385c, 2);                         // 385a and #$0f
  return m.call(0x385c);                                     // 385c fall-through -> loc_385c
}
