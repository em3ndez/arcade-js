// SPDX-License-Identifier: GPL-3.0-only
// loc_df59  (ROM 0xdf59-0xdf5e) -- store A then X at ($74),y / ($74),y+1, falls through into loc_df5f.
export function loc_df59(m) {
  const { regs, mem } = m;
  let ptr = mem.read8(0x0074) | (mem.read8(0x0075) << 8);
  mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xdf5b, 6);
  regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xdf5c, 2);
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0xdf5d, 2);
  ptr = mem.read8(0x0074) | (mem.read8(0x0075) << 8);
  mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xdf5f, 6);
  return m.call(0xdf5f);
}
