// SPDX-License-Identifier: GPL-3.0-only
// loc_02f8 (ROM 0x02f8-0x032b) -- jmp'd at 0x0335, fallen into from loc_02ed/loc_0332: call 0x0878, stow
// DE/B into record at HL, call 0x01e4, pop psw + pick tile pair by bit0, publish 0x2067, clear 0x2011, OUT 05, write 0x2098, tail-jmp 0x07f9.
export function loc_02f8(m) {
  const { regs, mem } = m;
  m.push16(0x02fb); m.step(0x0878, 17); m.call(0x0878); // 02f8  call 0x0878
  mem.write8(regs.hl, regs.e); m.step(0x02fc, 7);       // 02fb  mov m,e
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x02fd, 5);  // 02fc  inx h
  mem.write8(regs.hl, regs.d); m.step(0x02fe, 7);       // 02fd  mov m,d
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x02ff, 5);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0300, 5);
  mem.write8(regs.hl, regs.b); m.step(0x0301, 7);       // 0300  mov m,b
  m.step(0x0302, 4);
  m.push16(0x0305); m.step(0x01e4, 17); m.call(0x01e4); // 0302  call 0x01e4
  regs.af = m.pop16(); m.step(0x0306, 10);              // 0305  pop psw
  regs.rrca(); m.step(0x0307, 4);                       // 0306  rrc
  regs.a = 0x21; m.step(0x0309, 7);                     // 0307  mvi a,0x21
  regs.b = 0x00; m.step(0x030b, 7);                     // 0309  mvi b,0x00
  if (regs.fNC) {
    m.step(0x0312, 10);
  } else {
    m.step(0x030e, 10);
    regs.b = 0x20; m.step(0x0310, 7);                   // 030e  mvi b,0x20
    regs.a = 0x22; m.step(0x0312, 7);                   // 0310  mvi a,0x22
  }
  mem.write8(0x2067, regs.a); m.step(0x0315, 13);       // 0312  sta 0x2067
  m.push16(0x0318); m.step(0x0ab6, 17); m.call(0x0ab6); // 0315  call 0x0ab6
  regs.xor(regs.a); m.step(0x0319, 4);
  mem.write8(0x2011, regs.a); m.step(0x031c, 13);       // 0319  sta 0x2011
  regs.a = regs.b; m.step(0x031d, 5);
  m.io.portOut(0x05, regs.a); m.step(0x031f, 10);       // 031d  out 0x05
  regs.a = regs.inc8(regs.a); m.step(0x0320, 5);        // 031f  inr a
  mem.write8(0x2098, regs.a); m.step(0x0323, 13);       // 0320  sta 0x2098
  m.push16(0x0326); m.step(0x09d6, 17); m.call(0x09d6); // 0323  call 0x09d6
  m.push16(0x0329); m.step(0x1a7f, 17); m.call(0x1a7f); // 0326  call 0x1a7f
  m.step(0x07f9, 10);                                   // 0329  jmp 0x07f9
  return m.call(0x07f9);
}
