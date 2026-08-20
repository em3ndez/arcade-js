// SPDX-License-Identifier: GPL-3.0-only

// loc_6166  (ROM 0x6166-0x6189) -- reset the actor record at IY: zero (iy+0), seat
// (iy+1)=0x01 (iy+2)=0x08 (iy+0x16)=0x07 (iy+0x17)=0x05, zero (iy+0x14)/(iy+0x13). Then
// 0x8d44!=3 -> (0x619a) call 0x0ef1 + jr loc_618a; ==3 -> call 0x0efd + fall into loc_618a.
export function loc_6166(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);                                m.step(0x6167, 4);
  mem.write8((regs.iy + 0x00) & 0xffff, regs.a);   m.step(0x616a, 19);
  mem.write8((regs.iy + 0x01) & 0xffff, 0x01);     m.step(0x616e, 19);
  mem.write8((regs.iy + 0x02) & 0xffff, 0x08);     m.step(0x6172, 19);
  mem.write8((regs.iy + 0x16) & 0xffff, 0x07);     m.step(0x6176, 19);
  mem.write8((regs.iy + 0x17) & 0xffff, 0x05);     m.step(0x617a, 19);
  mem.write8((regs.iy + 0x14) & 0xffff, regs.a);   m.step(0x617d, 19);
  mem.write8((regs.iy + 0x13) & 0xffff, regs.a);   m.step(0x6180, 19);
  regs.a = mem.read8(0x8d44);                      m.step(0x6183, 13);
  regs.cp(0x03);                                   m.step(0x6185, 7);
  if (regs.fNZ) {
    m.step(0x619a, 12);                            // jr nz -> inlined 0x619a
    m.push16(0x619d);
    m.step(0x0ef1, 17);                            // 619a  call 0x0ef1
    m.call(0x0ef1);
    m.step(0x618a, 12);                            // 619d  jr 0x618a (tail)
    return m.call(0x618a);
  }
  m.step(0x6187, 7);                               // jr nz not taken
  m.push16(0x618a);
  m.step(0x0efd, 17);                              // 6187  call 0x0efd
  m.call(0x0efd);
  return m.call(0x618a);                           // fall through into loc_618a
}
