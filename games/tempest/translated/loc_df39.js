// SPDX-License-Identifier: GPL-3.0-only
// loc_df39  (ROM 0xdf39-0xdf4b) -- emit a two-byte word: hi=(A>>1)&0x0f|0xa0 at ($74),1 and lo=(X ror) at
// ($74),0, then bne loc_df5f (advance cursor); the fall-path (Y wrapped to 0) reloads Y=$73 into loc_df4c.
export function loc_df39(m) {
  const { regs, mem } = m;
  regs.a = regs.lsr(regs.a); m.step(0xdf3a, 2);
  regs.and(0x0f); m.step(0xdf3c, 2);
  regs.ora(0xa0); m.step(0xdf3e, 2);
  regs.y = 0x01; regs.setNZ(regs.y); m.step(0xdf40, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf42, 6);
  regs.y = regs.dec8(regs.y); m.step(0xdf43, 2);
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0xdf44, 2);
  regs.a = regs.ror(regs.a); m.step(0xdf45, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf47, 6);
  regs.y = regs.inc8(regs.y); m.step(0xdf48, 2);
  if (regs.fNZ) { m.step(0xdf5f, 3); return m.call(0xdf5f); }
  m.step(0xdf4a, 2);
  regs.y = mem.read8(0x73); regs.setNZ(regs.y); m.step(0xdf4c, 3);
  return m.call(0xdf4c);
}
