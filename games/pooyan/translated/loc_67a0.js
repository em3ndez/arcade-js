// SPDX-License-Identifier: GPL-3.0-only

// loc_67a0  (ROM 0x67a0-0x67de) -- per-object frame update. Frame counter at 0x8929: while
// non-zero, decrement and return. On expiry: run the animation sequencer loc_4006, then step
// two 16-bit positions by (ix+9). If the linked record pointer (ix+7/8) has a non-zero high
// byte, IY = that pointer and (iy+5):(iy+6) -= (ix+9) (borrow decs +6). Always (ix+5):(ix+6)
// -= (ix+9). When the high byte (ix+6) reaches 0, advance the object's state via inc (ix+2).
export function loc_67a0(m) {
  const { regs, mem } = m;

  regs.hl = 0x8929;              m.step(0x67a3, 10);
  regs.a = mem.read8(regs.hl);   m.step(0x67a4, 7);
  regs.and(regs.a);              m.step(0x67a5, 4);
  if (regs.fNZ) {
    m.step(0x67a7, 7);
    regs.decMem8(mem, regs.hl);  m.step(0x67a8, 11); // dec (hl)
    m.ret();                     // 67a8  ret
    return;
  }
  m.step(0x67a9, 12);

  m.push16(0x67ac);
  m.step(0x4006, 17);            // 67a9  call 0x4006
  m.call(0x4006);

  regs.l = mem.read8((regs.ix + 7) & 0xffff); m.step(0x67af, 19);
  regs.h = mem.read8((regs.ix + 8) & 0xffff); m.step(0x67b2, 19);
  regs.a = regs.h;              m.step(0x67b3, 4);
  regs.and(regs.a);             m.step(0x67b4, 4);
  if (regs.fZ) {
    m.step(0x67c7, 12); // jr z -- no linked record
  } else {
    m.step(0x67b6, 7);
    m.push16(regs.hl);          m.step(0x67b7, 11); // push hl
    regs.iy = m.pop16();        m.step(0x67b9, 14); // pop iy -- IY = HL
    regs.a = mem.read8((regs.iy + 5) & 0xffff); m.step(0x67bc, 19);
    regs.sub(mem.read8((regs.ix + 9) & 0xffff)); m.step(0x67bf, 19);
    if (regs.fNC) {
      m.step(0x67c4, 12);
    } else {
      m.step(0x67c1, 7);
      regs.decMem8(mem, (regs.iy + 6) & 0xffff); m.step(0x67c4, 23); // dec (iy+6) -- borrow
    }
    mem.write8((regs.iy + 5) & 0xffff, regs.a); m.step(0x67c7, 19);
  }

  regs.a = mem.read8((regs.ix + 5) & 0xffff); m.step(0x67ca, 19);
  regs.sub(mem.read8((regs.ix + 9) & 0xffff)); m.step(0x67cd, 19);
  if (regs.fNC) {
    m.step(0x67d2, 12);
  } else {
    m.step(0x67cf, 7);
    regs.decMem8(mem, (regs.ix + 6) & 0xffff); m.step(0x67d2, 23); // dec (ix+6) -- borrow
  }
  mem.write8((regs.ix + 5) & 0xffff, regs.a);  m.step(0x67d5, 19);
  regs.a = mem.read8((regs.ix + 6) & 0xffff);  m.step(0x67d8, 19);
  regs.cp(0x00);                m.step(0x67da, 7);
  if (regs.fNZ) { return m.ret(11); } // ret nz -- still counting down
  m.step(0x67db, 5);
  regs.incMem8(mem, (regs.ix + 2) & 0xffff);   m.step(0x67de, 23); // inc (ix+2) -- next state
  m.ret(); // 67de  ret
}
