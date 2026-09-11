// SPDX-License-Identifier: GPL-3.0-only
// loc_96c7 (ROM 0x96c7-0x96ca) -- advance the (0x2c) list index by 3 (entry 0x96c7) or 2 (entry 0x96c8),
// then rts. Dispatch-table targets ($969d table via loc_9683).
export function loc_96c7(m) {
  const { regs } = m;
  regs.y = regs.inc8(regs.y); m.step(0x96c8, 2);
  return loc_96c8(m);
}

export function loc_96c8(m) {
  const { regs } = m;
  regs.y = regs.inc8(regs.y); m.step(0x96c9, 2);
  regs.y = regs.inc8(regs.y); m.step(0x96ca, 2);
  return m.ret(6);
}
