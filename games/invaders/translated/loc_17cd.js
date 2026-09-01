// SPDX-License-Identifier: GPL-3.0-only
// loc_17cd  (ROM 0x17cd-0x1803) -- called from 0x001d. Returns unless port2 bit2 is set and 0x209a clear;
// else re-seat SP, clear the screen (four 0x09d6 passes), mark 0x209a, re-init, EI, redraw, clear flags, jmp 0x16c9.
export function loc_17cd(m) {
  const { regs, mem } = m;

  regs.a = m.io.portIn(0x02); m.step(0x17cf, 10); // 17cd  in 0x02
  regs.and(0x04); m.step(0x17d1, 7); // 17cf  ani 0x04
  if (regs.fZ) { return m.ret(11); } m.step(0x17d2, 5);
  regs.a = mem.read8(0x209a); m.step(0x17d5, 13); // 17d2  lda 0x209a
  regs.and(regs.a); m.step(0x17d6, 4); // 17d5  ana a
  if (regs.fNZ) { return m.ret(11); } m.step(0x17d7, 5);
  regs.sp = 0x2400; m.step(0x17da, 10); // 17d7  lxi sp,0x2400
  regs.b = 0x04; m.step(0x17dc, 7); // 17da  mvi b,0x04
  for (;;) { // loc_17dc
    m.push16(0x17df); m.step(0x09d6, 17); m.call(0x09d6);
    regs.b = regs.dec8(regs.b); m.step(0x17e0, 5); // 17df  dcr b
    if (regs.fNZ) { m.step(0x17dc, 10); continue; }
    m.step(0x17e3, 10); break;
  }
  regs.a = 0x01; m.step(0x17e5, 7); // 17e3  mvi a,0x01
  mem.write8(0x209a, regs.a); m.step(0x17e8, 13); // 17e5  sta 0x209a
  m.push16(0x17eb); m.step(0x19d7, 17); m.call(0x19d7);
  m.io.setInte(true); m.step(0x17ec, 4); // 17eb  ei
  regs.de = 0x1cbc; m.step(0x17ef, 10); // 17ec  lxi d,0x1cbc
  regs.hl = 0x3016; m.step(0x17f2, 10); // 17ef  lxi h,0x3016
  regs.c = 0x04; m.step(0x17f4, 7); // 17f2  mvi c,0x04
  m.push16(0x17f7); m.step(0x0a93, 17); m.call(0x0a93); // 17f4  call 0x0a93
  m.push16(0x17fa); m.step(0x0ab1, 17); m.call(0x0ab1); // 17f7  call 0x0ab1
  regs.xor(regs.a); m.step(0x17fb, 4); // 17fa  xra a
  mem.write8(0x209a, regs.a); m.step(0x17fe, 13); // 17fb  sta 0x209a
  mem.write8(0x2093, regs.a); m.step(0x1801, 13); // 17fe  sta 0x2093
  m.step(0x16c9, 10); return m.call(0x16c9);
}
