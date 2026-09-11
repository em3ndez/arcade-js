// SPDX-License-Identifier: GPL-3.0-only
// loc_df0d  (ROM 0xdf0d-0xdf18) -- calls loc_df53 (emit {0x40,0x80} header), then A=0x20; entry loc_df12
// (reached from loc_df09 with A preset) stores A at ($74),0 and jmp $dfac (into loc_df92's tail store).
export function loc_df0d(m) {
  const { regs, mem } = m;
  m.push16(0xdf0f); m.step(0xdf10, 6); m.call(0xdf53);
  regs.a = 0x20; regs.setNZ(regs.a); m.step(0xdf12, 2);
  return loc_df12(m);
}

export function loc_df12(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdf14, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf16, 6);
  m.step(0xdfac, 3); return m.call(0xdfac);
}
