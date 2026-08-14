// SPDX-License-Identifier: GPL-3.0-only

// loc_2ca8  (ROM 0x2CA8-0x2CD5) — IX sprite-object arm: proximity test between the sprite Y at (iy+0x00)
// and the frog. Returns unless the object is active ((ix+0x06)!=0) and on the frog's row ((ix+0x04)==
// (0x8047)). Then A = (iy+0x00) adjusted by -0x04 when (ix+0x05)!=0 else +0x14, minus (0x8044); if that
// lands in [0,0x10) it flags a hit: (0x8004)=0x01 and (ix+0x06)=0x02. Leaf; IX = record, IY = slot.
export function loc_2ca8(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x2cab, 19); // (ix+0x06) -- object state
  regs.or(regs.a);
  m.step(0x2cac, 4);
  if (regs.fZ) { m.ret(11); return; } // ret z -- inactive
  m.step(0x2cad, 5);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x2cb0, 19); // (ix+0x04) -- object row
  regs.hl = 0x8047;
  m.step(0x2cb3, 10);
  regs.cp(mem.read8(regs.hl)); // vs frog row (0x8047)
  m.step(0x2cb4, 7);
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- different row
  m.step(0x2cb5, 5);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x2cb8, 19); // (ix+0x05) -- direction
  regs.or(regs.a);
  m.step(0x2cb9, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); // sprite Y
  m.step(0x2cbc, 19);
  regs.hl = 0x8044;
  m.step(0x2cbf, 10);
  if (regs.fNZ) {
    m.step(0x2cc5, 12);
    regs.sub(0x04);
    m.step(0x2cc7, 7);
    return block_0x2cc7();
  }
  m.step(0x2cc1, 7);
  regs.add(0x14);
  m.step(0x2cc3, 7);
  m.step(0x2cc7, 12); // jr 0x2CC7
  return block_0x2cc7();

  function block_0x2cc7() {
    regs.sub(mem.read8(regs.hl)); // - frog X (0x8044)
    m.step(0x2cc8, 7);
    if (regs.fC) { m.ret(11); return; } // ret c -- object left of frog
    m.step(0x2cc9, 5);
    regs.cp(0x10);
    m.step(0x2ccb, 7);
    if (regs.fNC) { m.ret(11); return; } // ret nc -- too far right
    m.step(0x2ccc, 5);
    regs.a = 0x01;
    m.step(0x2cce, 7);
    mem.write8(0x8004, regs.a); // (0x8004) = 1 -- hit flag
    m.step(0x2cd1, 13);
    mem.write8((regs.ix + 0x06) & 0xffff, 0x02); // (ix+0x06) = 2
    m.step(0x2cd5, 19);
    m.ret();
  }
}
