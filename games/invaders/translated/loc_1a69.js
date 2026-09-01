// SPDX-License-Identifier: GPL-3.0-only
// loc_1a69  (ROM 0x1a69-0x1a7e) -- OR-merge blit. Outer over B rows: OR C source bytes at DE into the
// destination at HL, then advance HL by 0x20 to the next row (DE keeps running). Inner loop drains C.
export function loc_1a69(m) {
  const { regs, mem } = m;

  for (;;) { // loc_1a69 (outer, B rows)
    m.push16(regs.bc); m.step(0x1a6a, 11); // 1a69  push b
    m.push16(regs.hl); m.step(0x1a6b, 11); // 1a6a  push h
    for (;;) { // loc_1a6b (inner, C bytes)
      regs.a = mem.read8(regs.de); m.step(0x1a6c, 7); // 1a6b  ldax d
      regs.or(mem.read8(regs.hl)); m.step(0x1a6d, 7); // 1a6c  ora m
      mem.write8(regs.hl, regs.a); m.step(0x1a6e, 7); // 1a6d  mov m,a
      regs.de = (regs.de + 1) & 0xffff; m.step(0x1a6f, 5); // 1a6e  inx d
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1a70, 5); // 1a6f  inx h
      regs.c = regs.dec8(regs.c); m.step(0x1a71, 5); // 1a70  dcr c
      if (regs.fNZ) { m.step(0x1a6b, 10); continue; }
      m.step(0x1a74, 10); break;
    }
    regs.hl = m.pop16(); m.step(0x1a75, 10); // 1a74  pop h
    regs.bc = 0x0020; m.step(0x1a78, 10); // 1a75  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x1a79, 10); // 1a78  dad b
    regs.bc = m.pop16(); m.step(0x1a7a, 10); // 1a79  pop b
    regs.b = regs.dec8(regs.b); m.step(0x1a7b, 5); // 1a7a  dcr b
    if (regs.fNZ) { m.step(0x1a69, 10); continue; }
    m.step(0x1a7e, 10); break;
  }
  return m.ret(10); // 1a7e  ret
}
