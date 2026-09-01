// SPDX-License-Identifier: GPL-3.0-only
// loc_1a3b  (ROM 0x1a3b-0x1a46) -- reads a 5-byte descriptor at (HL) into DE, A, C, B (in order),
// then loads HL from (C,A) -> H:=C, L:=A. Returns with the fetched pointer live in HL.
export function loc_1a3b(m) {
  const { regs, mem } = m;
  regs.e = mem.read8(regs.hl); m.step(0x1a3c, 7);      // 1a3b  mov e,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1a3d, 5); // 1a3c  inx h
  regs.d = mem.read8(regs.hl); m.step(0x1a3e, 7);      // 1a3d  mov d,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1a3f, 5); // 1a3e  inx h
  regs.a = mem.read8(regs.hl); m.step(0x1a40, 7);      // 1a3f  mov a,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1a41, 5); // 1a40  inx h
  regs.c = mem.read8(regs.hl); m.step(0x1a42, 7);      // 1a41  mov c,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1a43, 5); // 1a42  inx h
  regs.b = mem.read8(regs.hl); m.step(0x1a44, 7);      // 1a43  mov b,m
  regs.h = regs.c; m.step(0x1a45, 5);                  // 1a44  mov h,c
  regs.l = regs.a; m.step(0x1a46, 5);                  // 1a45  mov l,a
  return m.ret(10);                                    // 1a46  ret
}
