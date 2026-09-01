// SPDX-License-Identifier: GPL-3.0-only
// loc_0141  (ROM 0x0141-0x0179) -- guard on 0x2068 (clear->ret) and 0x2000 (set->ret); scan slot
// table at (0x2067:index) past 0x2006, wrap via cz 0x01a1 at 0x37 until count==0; store index, resolve via loc_017a, bail 0x1971 (index<0x28) or latch D at 0x2004 + mark 0x2000.
export function loc_0141(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2068); m.step(0x0144, 13); // 0141  lda 0x2068
  regs.and(regs.a); m.step(0x0145, 4); // 0144  ana a
  if (regs.fZ) { return m.ret(11); } // 0145  rz
  m.step(0x0146, 5);
  regs.a = mem.read8(0x2000); m.step(0x0149, 13); // 0146  lda 0x2000
  regs.and(regs.a); m.step(0x014a, 4); // 0149  ana a
  if (regs.fNZ) { return m.ret(11); } // 014a  rnz
  m.step(0x014b, 5);
  regs.a = mem.read8(0x2067); m.step(0x014e, 13); // 014b  lda 0x2067
  regs.h = regs.a; m.step(0x014f, 5);
  regs.a = mem.read8(0x2006); m.step(0x0152, 13); // 014f  lda 0x2006
  regs.d = 0x02; m.step(0x0154, 7); // 0152  mvi d,0x02

  for (;;) { // loc_0154
    regs.a = regs.inc8(regs.a); m.step(0x0155, 5); // 0154  inr a
    regs.cp(0x37); m.step(0x0157, 7); // 0155  cpi 0x37
    if (regs.fZ) {
      m.push16(0x015a); m.step(0x01a1, 17); m.call(0x01a1);
    } else {
      m.step(0x015a, 11);
    }
    regs.l = regs.a; m.step(0x015b, 5);
    regs.b = mem.read8(regs.hl); m.step(0x015c, 7); // 015b  mov b,m
    regs.b = regs.dec8(regs.b); m.step(0x015d, 5); // 015c  dcr b
    if (regs.fNZ) { m.step(0x0154, 10); continue; } // 015d  jnz 0x0154
    m.step(0x0160, 10);
    break;
  }

  mem.write8(0x2006, regs.a); m.step(0x0163, 13); // 0160  sta 0x2006
  m.push16(0x0166); m.step(0x017a, 17); m.call(0x017a); // 0163  call 0x017a
  regs.h = regs.c; m.step(0x0167, 5);
  mem.write16(0x200b, regs.hl); m.step(0x016a, 16); // 0167  shld 0x200b
  regs.a = regs.l; m.step(0x016b, 5);
  regs.cp(0x28); m.step(0x016d, 7); // 016b  cpi 0x28
  if (regs.fC) { m.step(0x1971, 10); return m.call(0x1971); } // 016d  jc 0x1971
  m.step(0x0170, 10);
  regs.a = regs.d; m.step(0x0171, 5); // 0170  mov a,d
  mem.write8(0x2004, regs.a); m.step(0x0174, 13); // 0171  sta 0x2004
  regs.a = 0x01; m.step(0x0176, 7); // 0174  mvi a,0x01
  mem.write8(0x2000, regs.a); m.step(0x0179, 13); // 0176  sta 0x2000
  return m.ret(10); // 0179  ret
}
