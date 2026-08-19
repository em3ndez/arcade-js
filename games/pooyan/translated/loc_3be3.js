// SPDX-License-Identifier: GPL-3.0-only

// loc_3be3  (ROM 0x3be3-0x3c91) -- object state-0 handler (0x33a7 dispatch table, index 0).
// First ticks the shared timer helper loc_4006. With (ix+0x08) bit0 set it homes the object toward
// a target using the negated velocity (ix+0x0a) and mirrors the result into the linked record at
// (ix+0x14:0x15); with bit0 clear it free-runs (ix+0x05) by (ix+0x09) until it reaches 0x1f. On the
// arrival branch (0x3c3b) it bumps score/counters (0x8903, 0x8d40, 0x8d7d), runs loc_3553, and -- if
// several gate bytes line up -- verifies an 0x12-byte ROM checksum at 0x01d5 (==0x55), bumping the
// tamper counter (0x89ed) on mismatch. The 0x3c03-0x3c0f tail is unreached (the 0x3c01 jr skips it).
export function loc_3be3(m) {
  const { regs, mem } = m;

  m.push16(0x3be6); m.step(0x4006, 17); m.call(0x4006);
  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x3bea, 20);
  if (regs.fNZ) {
    m.step(0x3c10, 12); // 3bea  jr nz,0x3c10 -- homing branch
    regs.a = mem.read8((regs.ix + 0x0a) & 0xffff); m.step(0x3c13, 19);
    regs.neg(); m.step(0x3c15, 8);
    regs.b = regs.a; m.step(0x3c16, 4);
    regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x3c19, 19);
    regs.cp(regs.b); m.step(0x3c1a, 4);
    if (regs.fNC) {
      m.step(0x3c1f, 12);
    } else {
      m.step(0x3c1c, 7);
      regs.decMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x3c1f, 23);
    }
    regs.add(mem.read8((regs.ix + 0x0a) & 0xffff)); m.step(0x3c22, 19);
    mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x3c25, 19);
    regs.b = regs.a; m.step(0x3c26, 4);
    regs.l = mem.read8((regs.ix + 0x14) & 0xffff); m.step(0x3c29, 19);
    regs.h = mem.read8((regs.ix + 0x15) & 0xffff); m.step(0x3c2c, 19);
    m.push16(regs.hl); m.step(0x3c2d, 11);
    regs.iy = m.pop16(); m.step(0x3c2f, 14); // 3c2d  pop iy -- IY = linked record
    mem.write8((regs.iy + 0x05) & 0xffff, regs.a); m.step(0x3c32, 19);
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3c35, 19);
    mem.write8((regs.iy + 0x06) & 0xffff, regs.a); m.step(0x3c38, 19);
    regs.and(0x1f); m.step(0x3c3a, 7);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x3c3b, 5);
  } else {
    m.step(0x3bec, 7); // 3bea  jr nz (not taken) -- free-run branch
    regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x3bef, 19);
    regs.add(mem.read8((regs.ix + 0x09) & 0xffff)); m.step(0x3bf2, 19);
    if (regs.fNC) {
      m.step(0x3bf7, 12);
    } else {
      m.step(0x3bf4, 7);
      regs.incMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x3bf7, 23);
    }
    mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x3bfa, 19);
    regs.b = regs.a; m.step(0x3bfb, 4);
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3bfe, 19);
    regs.cp(0x1f); m.step(0x3c00, 7);
    if (regs.fC) { m.ret(11); return; }
    m.step(0x3c01, 5);
    m.step(0x3c3b, 12);
  }

  // loc_3c3b: arrival -- bump counters, run loc_3553, then the gated ROM-checksum guard
  regs.hl = 0x8903; m.step(0x3c3e, 10);
  regs.incMem8(mem, regs.hl); m.step(0x3c3f, 11);
  regs.hl = 0x8d40; m.step(0x3c42, 10);
  regs.decMem8(mem, regs.hl); m.step(0x3c43, 11);
  regs.l = 0x7d; m.step(0x3c45, 7); // 3c43  ld l,0x7d -- HL = 0x8d7d
  regs.incMem8(mem, regs.hl); m.step(0x3c46, 11);
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff); m.step(0x3c49, 19);
  regs.and(0xf0); m.step(0x3c4b, 7);
  if (regs.fZ) { m.step(0x3553, 10); return m.call(0x3553); }
  m.step(0x3c4e, 10);
  m.push16(0x3c51); m.step(0x3553, 17); m.call(0x3553);
  regs.a = mem.read8(0x8d7e); m.step(0x3c54, 13);
  regs.and(regs.a); m.step(0x3c55, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x3c56, 5);
  regs.hl = 0x8d76; m.step(0x3c59, 10);
  regs.incMem8(mem, regs.hl); m.step(0x3c5a, 11);
  regs.a = mem.read8(regs.hl); m.step(0x3c5b, 7);
  regs.cp(0x02); m.step(0x3c5d, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x3c5e, 5);
  regs.l = regs.dec8(regs.l); m.step(0x3c5f, 4); // 3c5e  dec l -- HL = 0x8d75
  regs.xor(regs.a); m.step(0x3c60, 4);
  mem.write8(regs.hl, regs.a); m.step(0x3c61, 7);
  mem.write8(0x8f20, regs.a); m.step(0x3c64, 13);
  mem.write8(0x8d6d, regs.a); m.step(0x3c67, 13);
  mem.write8(0x8d6e, regs.a); m.step(0x3c6a, 13);
  regs.a = 0x02; m.step(0x3c6c, 7);
  mem.write8(0x8d07, regs.a); m.step(0x3c6f, 13);
  mem.write8(0x8d7e, regs.a); m.step(0x3c72, 13);
  regs.a = mem.read8(0x881f); m.step(0x3c75, 13);
  regs.and(regs.a); m.step(0x3c76, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x3c77, 5);
  regs.a = mem.read8(0x8901); m.step(0x3c7a, 13);
  regs.cp(0x10); m.step(0x3c7c, 7);
  if (regs.fNC) { m.ret(11); return; }
  m.step(0x3c7d, 5);

  regs.de = 0x01d5; m.step(0x3c80, 10);
  regs.bc = 0x0012; m.step(0x3c83, 10);
  for (;;) {
    regs.a = mem.read8(regs.de); m.step(0x3c84, 7);
    regs.de = (regs.de - 1) & 0xffff; m.step(0x3c85, 6);
    regs.add(regs.b); m.step(0x3c86, 4);
    regs.b = regs.a; m.step(0x3c87, 4);
    regs.c = regs.dec8(regs.c); m.step(0x3c88, 4);
    if (regs.fNZ) { m.step(0x3c83, 12); continue; }
    m.step(0x3c8a, 7);
    break;
  }
  regs.cp(0x55); m.step(0x3c8c, 7);
  if (regs.fZ) { m.ret(11); return; } // 3c8c  ret z -- checksum OK
  m.step(0x3c8d, 5);
  regs.hl = 0x89ed; m.step(0x3c90, 10);
  regs.incMem8(mem, regs.hl); m.step(0x3c91, 11); // 3c90  inc (hl) -- tamper counter
  m.ret();
}
