// SPDX-License-Identifier: GPL-3.0-only

// loc_7395  (ROM 0x7395-0x73cd) -- eagle-record state 1 (dive). Runs the generic mover 0x4006, then
// integrates the 16-bit vertical position (ix+3):(ix+4) by the per-record speed (ix+9). Even records
// (bit3 of IXL clear) descend: add speed, carry bumps the row (ix+4); at row >= 0x1d the record
// advances state ((ix+2)++). Odd records ascend: subtract speed, borrow decrements (ix+4); at row
// < 0x04 the record advances state.
export function loc_7395(m) {
  const { regs, mem } = m;

  m.push16(0x7398);
  m.step(0x4006, 17); // 7395  call 0x4006
  m.call(0x4006);
  regs.a = regs.ix & 0xff;
  m.step(0x739a, 8); // 7398  ld a,ixl
  regs.bit(3, regs.a);
  m.step(0x739c, 8); // 739a  bit 3,a
  if (regs.fNZ) {
    m.step(0x73b6, 12); // 739c  jr nz,0x73b6 -- odd record ascends
    regs.a = mem.read8((regs.ix + 0x03) & 0xffff);
    m.step(0x73b9, 19); // 73b6  ld a,(ix+0x03)
    regs.sub(mem.read8((regs.ix + 0x09) & 0xffff));
    m.step(0x73bc, 19); // 73b9  sub (ix+0x09)
    mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
    m.step(0x73bf, 19); // 73bc  ld (ix+0x03),a
    if (regs.fNC) {
      m.step(0x73c4, 12); // 73bf  jr nc,0x73c4
    } else {
      m.step(0x73c1, 7);
      regs.decMem8(mem, (regs.ix + 0x04) & 0xffff);
      m.step(0x73c4, 23); // 73c1  dec (ix+0x04)
    }
    regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
    m.step(0x73c7, 19); // 73c4  ld a,(ix+0x04)
    regs.cp(0x04);
    m.step(0x73c9, 7); // 73c7  cp 0x04
    if (regs.fNC) { m.ret(11); return; } // 73c9  ret nc
    m.step(0x73ca, 5);
    regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
    m.step(0x73cd, 23); // 73ca  inc (ix+0x02)
    m.ret(); // 73cd  ret
    return;
  }
  m.step(0x739e, 7);
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x73a1, 19); // 739e  ld a,(ix+0x03)
  regs.add(mem.read8((regs.ix + 0x09) & 0xffff));
  m.step(0x73a4, 19); // 73a1  add a,(ix+0x09)
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x73a7, 19); // 73a4  ld (ix+0x03),a
  if (regs.fNC) {
    m.step(0x73ac, 12); // 73a7  jr nc,0x73ac
  } else {
    m.step(0x73a9, 7);
    regs.incMem8(mem, (regs.ix + 0x04) & 0xffff);
    m.step(0x73ac, 23); // 73a9  inc (ix+0x04)
  }
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x73af, 19); // 73ac  ld a,(ix+0x04)
  regs.cp(0x1d);
  m.step(0x73b1, 7); // 73af  cp 0x1d
  if (regs.fC) { m.ret(11); return; } // 73b1  ret c
  m.step(0x73b2, 5);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x73b5, 23); // 73b2  inc (ix+0x02)
  m.ret(); // 73b5  ret
}
