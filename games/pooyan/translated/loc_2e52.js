// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2e52  (ROM 0x2e52-0x2e5d) -- compute the video-RAM column base for the rope cell (IXL & 3):
// HL = 0x8400 + table_0x2db8[IXL&3]. Plain-ret helper (pattern A) used by the rope-cell handlers.
// rst 0x20 = loc_0020; table 0x2db8 is ROM data.
export function loc_2e52(m) {
  const { regs } = m;

  regs.a = regs.ix & 0xff; m.step(0x2e54, 8); // 2e52  ld a,ixl
  regs.and(0x03); m.step(0x2e56, 7); // 2e54  and 0x03
  regs.hl = 0x2db8; m.step(0x2e59, 10); // 2e56  ld hl,0x2db8
  m.push16(0x2e5a); m.step(0x0020, 11); m.call(0x0020); // 2e59  rst 0x20 (A := table_0x2db8[A])
  regs.l = regs.a; m.step(0x2e5b, 4); // 2e5a  ld l,a
  regs.h = 0x84; m.step(0x2e5d, 7); // 2e5b  ld h,0x84
  m.ret(); // 2e5d  ret
}
