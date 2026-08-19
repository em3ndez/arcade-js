// SPDX-License-Identifier: GPL-3.0-only

// loc_3d99  (ROM 0x3d99-0x3db2) -- entered by loc_3d5c (jp z at phase 7) and by the dispatch at
// 0x153f. Selects one of three animations from table 0x4076 by (ix+0x07)&0x03 - 1 (loc_0c45),
// installs it (loc_381e), sets velocity (ix+0x09)=0x40 and state (ix+0x02)=0x0f, then tail-jumps to
// loc_0ed6. The 0x3db3-0x3e68 bytes after the jump are jump/animation TABLE data (rst-0x38 switch
// targets for loc_3d18/loc_3d5c and the loc_0c45 tables 0x3dd3/0x3e49), read from ROM directly.
export function loc_3d99(m) {
  const { regs, mem } = m;

  regs.hl = 0x4076; m.step(0x3d9c, 10); // 3d99  ld hl,0x4076
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff); m.step(0x3d9f, 19); // 3d9c  ld a,(ix+0x07)
  regs.and(0x03); m.step(0x3da1, 7); // 3d9f  and 0x03
  regs.a = regs.dec8(regs.a); m.step(0x3da2, 4); // 3da1  dec a
  m.push16(0x3da5); m.step(0x0c45, 17); m.call(0x0c45); // 3da2  call 0x0c45 -> DE = anim word
  m.push16(0x3da8); m.step(0x381e, 17); m.call(0x381e); // 3da5  call 0x381e
  mem.write8((regs.ix + 0x09) & 0xffff, 0x40); m.step(0x3dac, 19); // 3da8  ld (ix+0x09),0x40
  mem.write8((regs.ix + 0x02) & 0xffff, 0x0f); m.step(0x3db0, 19); // 3dac  ld (ix+0x02),0x0f
  m.step(0x0ed6, 10); return m.call(0x0ed6); // 3db0  jp 0x0ed6
}
