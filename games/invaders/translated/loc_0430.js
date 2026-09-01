// SPDX-License-Identifier: GPL-3.0-only
// loc_0430 (ROM 0x0430-0x0435) -- CALLed helper: point HL at the object move-record base and
// tail-jmp the 0x1a3b step routine, delegating (never falls through).
export function loc_0430(m) {
  const { regs } = m;
  regs.hl = 0x2027; m.step(0x0433, 10);        // 0430 lxi h,0x2027
  m.step(0x1a3b, 10); return m.call(0x1a3b);   // 0433 jmp 0x1a3b
}
