// SPDX-License-Identifier: GPL-3.0-only
// loc_df5f  (ROM 0xdf5f-0xdf69) -- advance the ($74/$75) display-list cursor by Y+1 (tya;sec;adc $74),
// carrying into $75, then rts.
export function loc_df5f(m) {
  const { regs, mem } = m;
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xdf60, 2);
  regs.sec(); m.step(0xdf61, 2);
  regs.adc(mem.read8(0x74)); m.step(0xdf63, 3);
  mem.write8(0x74, regs.a); m.step(0xdf65, 3);
  if (regs.fNC) { m.step(0xdf69, 3); return m.ret(6); }
  m.step(0xdf67, 2);
  mem.write8(0x75, regs.inc8(mem.read8(0x75))); m.step(0xdf69, 5);
  return m.ret(6);
}
