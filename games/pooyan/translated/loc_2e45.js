// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2e45  (ROM 0x2e45-0x2e51) -- decrement one of four 0x8f28-based frame timers selected by
// (IXL & 3): HL = 0x8f28 + 2*(IXL&3), dec (HL). C is loaded with IXL for the caller. Plain-ret helper
// (pattern A) used by the rope-cell handlers 0x2e64/0x2ecb/0x2f04/0x2f2f.
export function loc_2e45(m) {
  const { regs, mem } = m;

  regs.a = regs.ix & 0xff; m.step(0x2e47, 8); // 2e45  ld a,ixl
  regs.c = regs.a; m.step(0x2e48, 4); // 2e47  ld c,a
  regs.and(0x03); m.step(0x2e4a, 7); // 2e48  and 0x03
  regs.add(regs.a); m.step(0x2e4b, 4); // 2e4a  add a,a
  regs.add(0x28); m.step(0x2e4d, 7); // 2e4b  add a,0x28
  regs.l = regs.a; m.step(0x2e4e, 4); // 2e4d  ld l,a
  regs.h = 0x8f; m.step(0x2e50, 7); // 2e4e  ld h,0x8f
  regs.decMem8(mem, regs.hl); m.step(0x2e51, 11); // 2e50  dec (hl)
  m.ret(); // 2e51  ret
}
