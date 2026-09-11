// SPDX-License-Identifier: GPL-3.0-only
// loc_df1f  (ROM 0xdf1f-0xdf38) -- A = (A & $0f) + 1; entry loc_df24 (jumped-to from loc_df19 with A preset)
// saves flags (php), then indexes the $31e4 word table by A*2 and stores the two bytes through ($74),y;
// jsr df5f advances the ($74) cursor; plp restores flags; rts. loc_df24 exported for the df19 branch.
export function loc_df1f(m) {
  const { regs } = m;
  regs.and(0x0f); m.step(0xdf21, 2);
  regs.clc(); m.step(0xdf22, 2);
  regs.adc(0x01); m.step(0xdf24, 2);
  return loc_df24(m);
}

export function loc_df24(m) {
  const { regs, mem } = m;
  m.push8(regs.p); m.step(0xdf25, 3);
  regs.a = regs.asl(regs.a); m.step(0xdf26, 2);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdf28, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xdf29, 2);
  regs.a = mem.read8((0x31e4 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xdf2c, 4);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf2e, 6);
  regs.a = mem.read8((0x31e5 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xdf31, 4);
  regs.y = regs.inc8(regs.y); m.step(0xdf32, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf34, 6);
  m.push16(0xdf36); m.step(0xdf37, 6); m.call(0xdf5f);
  regs.p = m.pull8(); m.step(0xdf38, 4);
  return m.ret(6);
}
