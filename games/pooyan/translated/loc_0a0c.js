// SPDX-License-Identifier: GPL-3.0-only

// loc_0a0c  (ROM 0x0a0c-0x0a24) -- seeds one object record at IX from a 2-byte (DE) descriptor
// and a 2-byte (HL) coordinate pair: (ix+6)=DE[0], (ix+4)=DE[1], (ix+0xc)=HL[0], (ix+0xd)=HL[1],
// (ix+0xe)=0 (timer cleared). DE advances by 2, HL by 2. Plain ret; no calls.
export function loc_0a0c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.de);
  m.step(0x0a0d, 7); // 0a0c  ld a,(de)
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a);
  m.step(0x0a10, 19); // 0a0d  ld (ix+0x06),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0a11, 6); // 0a10  inc de
  regs.a = mem.read8(regs.de);
  m.step(0x0a12, 7); // 0a11  ld a,(de)
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0a13, 6); // 0a12  inc de
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a);
  m.step(0x0a16, 19); // 0a13  ld (ix+0x04),a
  regs.a = mem.read8(regs.hl);
  m.step(0x0a17, 7); // 0a16  ld a,(hl)
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.a);
  m.step(0x0a1a, 19); // 0a17  ld (ix+0x0c),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0a1b, 6); // 0a1a  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x0a1c, 7); // 0a1b  ld a,(hl)
  mem.write8((regs.ix + 0x0d) & 0xffff, regs.a);
  m.step(0x0a1f, 19); // 0a1c  ld (ix+0x0d),a
  mem.write8((regs.ix + 0x0e) & 0xffff, 0x00);
  m.step(0x0a23, 19); // 0a1f  ld (ix+0x0e),0x00
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0a24, 6); // 0a23  inc hl
  m.ret(); // 0a24  ret
}
