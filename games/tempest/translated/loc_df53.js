// SPDX-License-Identifier: GPL-3.0-only
// loc_df53  (ROM 0xdf53-0xdf5e) -- emit the {0x40,0x80} header word. Entry loc_df57 is the shared tail
// (jumped-to with A/X preset): stores A then X through ($74),y and falls into loc_df5f to advance the cursor.
export function loc_df53(m) {
  const { regs, mem } = m;
  regs.a = 0x40; regs.setNZ(regs.a); m.step(0xdf55, 2);
  regs.x = 0x80; regs.setNZ(regs.x); m.step(0xdf57, 2);
  return loc_df57(m);
}

export function loc_df57(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdf59, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf5b, 6);
  regs.y = regs.inc8(regs.y); m.step(0xdf5c, 2);
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0xdf5d, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf5f, 6);
  return m.call(0xdf5f);
}
