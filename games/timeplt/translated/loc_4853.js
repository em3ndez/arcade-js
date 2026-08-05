// SPDX-License-Identifier: GPL-3.0-only

// loc_4853  (ROM 0x4853-0x488C)
export function loc_4853(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(0xad0d);
  m.step(0x4856, 13); // ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x4857, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz
    return;
  }
  m.step(0x4858, 5); // ret nz NOT taken

  regs.a = mem.read8(0xa980);
  m.step(0x485b, 13); // ld a,(0xa980)
  regs.and(0x01);
  m.step(0x485d, 7); // and 0x01
  if (regs.fZ) {
    m.ret(11); // ret z -- bit 0 of (0xA980) clear
    return;
  }
  m.step(0x485e, 5); // ret z NOT taken

  regs.decMem8(mem, IX(0x0e)); // dec (ix+0x0e)
  m.step(0x4861, 23); // dec (ix+0x0e)
  if (regs.fNZ) {
    m.ret(11); // ret nz -- still counting down
    return;
  }
  m.step(0x4862, 5); // ret nz NOT taken -- the counter expired

  regs.a = mem.read8(0xa802);
  m.step(0x4865, 13); // ld a,(0xa802)
  regs.add(0x08);
  m.step(0x4867, 7); // add a,0x08 -- half a step, for rounding
  regs.rrca();
  m.step(0x4868, 4); // rrca
  regs.rrca();
  m.step(0x4869, 4); // rrca
  regs.rrca();
  m.step(0x486a, 4); // rrca
  regs.and(0x1e);
  m.step(0x486c, 7); // and 0x1e -- even index into the pair table
  regs.hl = 0x488d;
  m.step(0x486f, 10); // ld hl,0x488d

  m.push16(0x4870);
  m.step(0x0008, 11); // rst 0x08 -- A = (0x488d + index); HL left at that byte
  m.call(0x0008);

  mem.write8(IY(0x31), regs.a);
  m.step(0x4873, 19); // ld (iy+0x31),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4874, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x4875, 7); // ld a,(hl) -- pair byte 1
  mem.write8(IY(0x00), regs.a);
  m.step(0x4878, 19); // ld (iy+0x00),a

  mem.write8(IX(0x0a), 0x00);
  m.step(0x487c, 19); // ld (ix+0x0a),0x00
  mem.write8(IX(0x0b), 0x00);
  m.step(0x4880, 19); // ld (ix+0x0b),0x00
  mem.write8(IX(0x0c), 0x40);
  m.step(0x4884, 19); // ld (ix+0x0c),0x40
  mem.write8(IX(0x0d), 0x00);
  m.step(0x4888, 19); // ld (ix+0x0d),0x00
  mem.write8(IX(0x00), 0xff);
  m.step(0x488c, 19); // ld (ix+0x00),0xff -- arm the slot

  m.ret(); // 488c
}
