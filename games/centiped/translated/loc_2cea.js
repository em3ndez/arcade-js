// SPDX-License-Identifier: GPL-3.0-only
// loc_2cea (ROM 0x2cea-0x2cee) -- second entry into the $2cc2 block: compares A to $0e (setting carry) then
// jumps to $2cc2, whose opening branch consumes that carry.
export function loc_2cea(m) {
  const { regs } = m;
  regs.cmp(0x0e); m.step(0x2cec, 2);                                                                 // 2cea cmp #$0e
  m.step(0x2cc2, 3); return m.call(0x2cc2);                                                          // 2cec jmp $2cc2
}
