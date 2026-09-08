// SPDX-License-Identifier: GPL-3.0-only
// loc_2505  (ROM 0x2505-0x2509) -- calls $231f then returns.
export function loc_2505(m) {
  const { regs, mem } = m;
  m.step(0x2508, 6); m.call(0x231f);                                            // 2505 jsr $231f
  return m.ret(6);                                                              // 2508 rts
}
