// SPDX-License-Identifier: GPL-3.0-only

// loc_26a6  (ROM 0x26A6-0x272E) — fly/insect collision animation. While no eat is in progress (0x8134==0)
// it (re)arms the tongue via the folded init (block_270d, ROM 0x270D-0x272E), runs the mover (call 0x272f),
// and box-tests the fly (0x8044/0x8040) against the frog (0x8047 row window) — on a hit it latches the eat
// (0x8134=1) + fires rst 0x18. block_26f0 copies the fly's live X/Y (IX=0x8044) to the sprite (IY=0x8040).
export function loc_26a6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8134);
  m.step(0x26a9, 13);
  regs.and(regs.a);
  m.step(0x26aa, 4);
  if (regs.fNZ) { m.step(0x26f0, 10); return block_26f0(); }
  m.step(0x26ad, 10);
  regs.ix = 0x811b;
  m.step(0x26b1, 14);
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x26b4, 19); // A = (ix+1) = the fly's active flag
  regs.and(regs.a);
  m.step(0x26b5, 4);
  if (regs.fZ) {
    m.push16(0x26b8);
    m.step(0x270d, 17);
    block_270d();
  } else {
    m.step(0x26b8, 10);
  }
  regs.a = mem.read8(0x813d);
  m.step(0x26bb, 13);
  regs.bit(0, regs.a);
  m.step(0x26bd, 8);
  if (regs.fNZ) { m.step(0x27b3, 10); return m.call(0x27b3); } // eat-retract tail
  m.step(0x26c0, 10);
  regs.a = mem.read8(0x8135);
  m.step(0x26c3, 13);
  regs.and(regs.a);
  m.step(0x26c4, 4);
  if (regs.fNZ) { m.step(0x26c7, 12); return block_26c7(); }
  m.step(0x26c6, 7);
  m.ret();

  function block_26c7() {
    regs.a = mem.read8(0x8134);
    m.step(0x26ca, 13);
    regs.and(regs.a);
    m.step(0x26cb, 4);
    if (regs.fNZ) { m.step(0x26f0, 12); return block_26f0(); }
    m.step(0x26cd, 7);
    m.push16(0x26d0);
    m.step(0x272f, 17);
    m.call(0x272f);
    regs.a = mem.read8(0x8047);
    m.step(0x26d3, 13);
    regs.cp(0x5a);
    m.step(0x26d5, 7);
    if (regs.fC) { m.ret(11); return; }
    m.step(0x26d6, 5); // below the row band -> no eat
    regs.cp(0x68);
    m.step(0x26d8, 7);
    if (regs.fNC) { m.ret(11); return; }
    m.step(0x26d9, 5); // above the row band -> no eat
    regs.a = mem.read8(0x8040);
    m.step(0x26dc, 13);
    regs.b = regs.a;
    m.step(0x26dd, 4); // B = the fly sprite X
    regs.a = mem.read8(0x8044);
    m.step(0x26e0, 13);
    regs.add(0x04);
    m.step(0x26e2, 7);
    regs.cp(regs.b);
    m.step(0x26e3, 4);
    if (regs.fC) { m.ret(11); return; }
    m.step(0x26e4, 5); // fly+4 left of the frog -> miss
    regs.sub(0x08);
    m.step(0x26e6, 7);
    regs.cp(regs.b);
    m.step(0x26e7, 4);
    if (regs.fNC) { m.ret(11); return; }
    m.step(0x26e8, 5); // fly-4 right of the frog -> miss
    regs.a = 0x01;
    m.step(0x26ea, 7);
    mem.write8(0x8134, regs.a);
    m.step(0x26ed, 13); // latch the eat
    regs.a = 0x18;
    m.step(0x26ef, 7);
    m.push16(0x26f0);
    m.step(0x0018, 11);
    m.call(0x0018); // rst 0x18 -- enqueue sound command 0x18
    return block_26f0();
  }

  function block_26f0() {
    regs.ix = 0x8044;
    m.step(0x26f4, 14);
    regs.iy = 0x8040;
    m.step(0x26f8, 14);
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x26fb, 19);
    mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
    m.step(0x26fe, 19); // sprite X = live X
    regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
    m.step(0x2701, 19);
    mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
    m.step(0x2704, 19); // sprite code = live code
    regs.a = mem.read8((regs.ix + 0x03) & 0xffff);
    m.step(0x2707, 19);
    regs.add(0x02);
    m.step(0x2709, 7);
    mem.write8((regs.iy + 0x03) & 0xffff, regs.a);
    m.step(0x270c, 19); // sprite Y = live Y + 2
    m.ret();
  }

  // folded arm-the-tongue init (ROM 0x270D-0x272E)
  function block_270d() {
    regs.a = mem.read8(0x8135);
    m.step(0x2710, 13);
    regs.and(regs.a);
    m.step(0x2711, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2712, 5);
    regs.hl = 0x813d;
    m.step(0x2715, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x2716, 11);
    regs.hl = 0x8041;
    m.step(0x2719, 10);
    mem.write8(regs.hl, 0x1e);
    m.step(0x271b, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x271c, 6);
    mem.write8(regs.hl, 0x04);
    m.step(0x271e, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x271f, 6);
    mem.write8(regs.hl, 0x60);
    m.step(0x2721, 10);
    regs.a = 0x01;
    m.step(0x2723, 7);
    mem.write8(0x8135, regs.a);
    m.step(0x2726, 13);
    mem.write8(0x833d, regs.a);
    m.step(0x2729, 13);
    regs.a = 0x3c;
    m.step(0x272b, 7);
    mem.write8(0x833e, regs.a);
    m.step(0x272e, 13);
    m.ret();
  }
}
