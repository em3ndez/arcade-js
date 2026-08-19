// SPDX-License-Identifier: GPL-3.0-only

// loc_3f5c  (ROM 0x3f5c-0x3f71) -- object state-7 handler (0x33a7 dispatch, index 7).
// Installs a fall/plummet animation chosen from table 0x4072 by (ix+0x07)&0x03 - 1 (loc_0c45 +
// loc_381e), sets the fall velocity (ix+0x09)=0x40, advances the state, and FALLS THROUGH into the
// state-8 handler loc_3f72.
export function loc_3f5c(m) {
  const { regs, mem } = m;

  regs.hl = 0x4072; m.step(0x3f5f, 10); // 3f5c  ld hl,0x4072
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff); m.step(0x3f62, 19); // 3f5f  ld a,(ix+0x07)
  regs.and(0x03); m.step(0x3f64, 7); // 3f62  and 0x03
  regs.a = regs.dec8(regs.a); m.step(0x3f65, 4); // 3f64  dec a
  m.push16(0x3f68); m.step(0x0c45, 17); m.call(0x0c45); // 3f65  call 0x0c45 -> DE = anim word
  m.push16(0x3f6b); m.step(0x381e, 17); m.call(0x381e); // 3f68  call 0x381e
  mem.write8((regs.ix + 0x09) & 0xffff, 0x40); m.step(0x3f6f, 19); // 3f6b  ld (ix+0x09),0x40
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x3f72, 23); // 3f6f  inc (ix+0x02)
  return m.call(0x3f72); // fall through into state-8 handler loc_3f72
}
