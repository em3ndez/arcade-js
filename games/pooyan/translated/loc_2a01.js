// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2a01  (ROM 0x2a01-0x2a31) -- 0x8a80 actor state 2 (dispatch 0x28f1[2]). Sets the flip bit
// (ix+0x10 bit7), paints three tiles 0xbc at 0x875a, advances the state, and runs a ROM self-check
// summing 0x20 bytes at 0x0839: sum-1 != 0 re-enters loc_2c58. On success it enqueues display command
// 0x0615 (rst 0x38) and, once (0x8903) reaches 0x09, resets it to 0x08. rst 0x38 = loc_0038.
export function loc_2a01(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x11) & 0xffff, 0x08); m.step(0x2a05, 19); // 2a01  ld (ix+0x11),0x08
  mem.write8((regs.ix + 0x10) & 0xffff, regs.set(7, mem.read8((regs.ix + 0x10) & 0xffff))); m.step(0x2a09, 23); // 2a05  set 7,(ix+0x10)
  regs.hl = 0x875a; m.step(0x2a0c, 10);
  regs.a = 0xbc; m.step(0x2a0e, 7);
  mem.write8(regs.hl, regs.a); m.step(0x2a0f, 7); // 2a0e  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2a10, 6);
  mem.write8(regs.hl, regs.a); m.step(0x2a11, 7); // 2a10  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2a12, 6);
  mem.write8(regs.hl, regs.a); m.step(0x2a13, 7); // 2a12  ld (hl),a
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2a16, 23); // 2a13  inc (ix+0x02)
  regs.xor(regs.a); m.step(0x2a17, 4);
  regs.hl = 0x0839; m.step(0x2a1a, 10);
  regs.b = 0x20; m.step(0x2a1c, 7);
  for (;;) {
    regs.add(mem.read8(regs.hl)); m.step(0x2a1d, 7); // 2a1c  add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2a1e, 6);
    if (regs.djnz() !== 0) { m.step(0x2a1c, 13); continue; }
    m.step(0x2a20, 8); break;
  }
  regs.a = regs.dec8(regs.a); m.step(0x2a21, 4);
  if (regs.fNZ) { m.step(0x2c58, 10); return m.call(0x2c58); } // 2a21  jp nz,0x2c58 (guard)
  m.step(0x2a24, 10);
  regs.de = 0x0615; m.step(0x2a27, 10);
  m.push16(0x2a28); m.step(0x0038, 11); m.call(0x0038);
  regs.hl = 0x8903; m.step(0x2a2b, 10);
  regs.a = mem.read8(regs.hl); m.step(0x2a2c, 7); // 2a2b  ld a,(hl)
  regs.cp(0x09); m.step(0x2a2e, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x2a2f, 5);
  mem.write8(regs.hl, 0x08); m.step(0x2a31, 10); // 2a2f  ld (hl),0x08
  m.ret();
}
