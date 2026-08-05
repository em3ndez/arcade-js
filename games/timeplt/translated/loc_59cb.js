// SPDX-License-Identifier: GPL-3.0-only

// loc_59cb  (ROM 0x59CB-0x59D0, Time Pilot)
export function loc_59cb(m) {
  const { regs } = m;

  regs.hl = 0x5c00;
  m.step(0x59ce, 10); // ld hl,0x5c00

  m.step(0x59a0, 10); // jp 0x59a0 -- TAIL jump, nothing pushed
  return m.call(0x59a0);
}
