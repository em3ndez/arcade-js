// SPDX-License-Identifier: GPL-3.0-only

// loc_1270  (ROM 0x1270-0x12ae) -- per-object update step. First runs the shared pre-step
// loc_4006. Reads the object's signed step (ix+0x0a), negates it into B, and compares the
// current sub-position (ix+0x05): if A < -(step) (carry) it borrows by decrementing the
// coarse counter (ix+0x06). It then advances the sub-position by the step (ix+0x0a) and
// stores it back. If the coarse counter (ix+0x06) is still nonzero it returns. Otherwise it
// runs loc_3553, decrements the timer at 0x8d40, decrements the counter at 0x8901 (twice --
// once unconditionally-guarded, once when nonzero), on state (0x880a)==4 bumps (0x8902),
// then if (C-1) < 0x0a stores it to 0x8743 before returning.
export function loc_1270(m) {
  const { regs, mem } = m;

  m.push16(0x1273);
  m.step(0x4006, 17);
  m.call(0x4006, "loc_4006 -- shared per-object pre-step");

  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff);
  m.step(0x1276, 19);
  regs.neg();
  m.step(0x1278, 8);
  regs.b = regs.a;
  m.step(0x1279, 4);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x127c, 19);
  regs.cp(regs.b);
  m.step(0x127d, 4);

  if (regs.fC) {
    m.step(0x127f, 7);
    // loc_127f
    regs.decMem8(mem, (regs.ix + 0x06) & 0xffff);
    m.step(0x1282, 23);
  } else {
    m.step(0x1282, 12);
  }

  // loc_1282
  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff));
  m.step(0x1285, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);
  m.step(0x1288, 19);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x128b, 19);

  // loc_128b
  regs.and(regs.a);
  m.step(0x128c, 4);
  if (!regs.fZ) {
    m.ret(11); // 128c  ret nz -- coarse counter still nonzero
    return;
  }
  m.step(0x128d, 5);

  m.push16(0x1290);
  m.step(0x3553, 17);
  m.call(0x3553, "loc_3553 -- coarse-tick handler");

  regs.hl = 0x8d40;
  m.step(0x1293, 10);
  regs.decMem8(mem, regs.hl);
  m.step(0x1294, 11);
  regs.hl = 0x8901;
  m.step(0x1297, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x1298, 7);
  regs.c = regs.a;
  m.step(0x1299, 4);
  regs.and(regs.a);
  m.step(0x129a, 4);

  if (regs.fZ) {
    m.step(0x129d, 12);
  } else {
    m.step(0x129c, 7);
    regs.decMem8(mem, regs.hl);
    m.step(0x129d, 11);
  }

  // loc_129d
  regs.a = mem.read8(0x880a);
  m.step(0x12a0, 13);
  regs.cp(0x04);
  m.step(0x12a2, 7);

  if (!regs.fZ) {
    m.step(0x12a6, 12);
  } else {
    m.step(0x12a4, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x12a5, 4);
    regs.incMem8(mem, regs.hl);
    m.step(0x12a6, 11);
  }

  // loc_12a6
  regs.a = regs.c;
  m.step(0x12a7, 4);
  regs.a = regs.dec8(regs.a);
  m.step(0x12a8, 4);
  regs.cp(0x0a);
  m.step(0x12aa, 7);
  if (!regs.fC) {
    m.ret(11); // 12aa  ret nc -- (C-1) >= 0x0a
    return;
  }
  m.step(0x12ab, 5);

  mem.write8(0x8743, regs.a);
  m.step(0x12ae, 13);
  m.ret();
}
