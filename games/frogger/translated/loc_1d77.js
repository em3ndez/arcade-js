// SPDX-License-Identifier: GPL-3.0-only

// loc_1d77  (ROM 0x1D77-0x1DD7) — home-row goal handlers row-0 (loc_1d77) and row-1 (loc_1d87),
// dispatched from the frog-Y cp-ladder loc_1cff. Both tail into the input scanner loc_1acb.
// loc_1d87 awards the goal (0x1f1c fill + 0x2673 bonus + 0x27cb) and steps the per-frog counters.

export function loc_1d77(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8047);
  m.step(0x1d7a, 13); // -- frog Y
  regs.cp(0x2a);
  m.step(0x1d7c, 7);
  if (regs.fNC) { m.step(0x1acb, 10); return m.call(0x1acb); }
  m.step(0x1d7f, 10);
  regs.a = 0x01;
  m.step(0x1d81, 7);
  mem.write8(0x8004, regs.a);
  m.step(0x1d84, 13); // (0x8004) = 1
  m.step(0x1acb, 10);
  return m.call(0x1acb); // jp loc_1acb
}

export function loc_1d87(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x1d8a, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1d8b, 4);
  if (regs.fNZ) { m.step(0x1dc9, 12); return block_1dc9(); }
  m.step(0x1d8d, 7);
  regs.a = mem.read8(0x825e);
  m.step(0x1d90, 13);
  return block_1d90();

  function block_1d90() {
    regs.and(regs.a);
    m.step(0x1d91, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x1d92, 5);
    regs.a = mem.read8(0x8047);
    m.step(0x1d95, 13); // -- frog Y
    regs.cp(0x2a);
    m.step(0x1d97, 7);
    if (regs.fNC) { m.step(0x1acb, 10); return m.call(0x1acb); }
    m.step(0x1d9a, 10);
    regs.b = 0x18;
    m.step(0x1d9c, 7);
    regs.a = mem.read8(0x8121);
    m.step(0x1d9f, 13);
    regs.sub(0x01);
    m.step(0x1da1, 7);
    if (regs.fZ) {
      m.push16(0x1da4);
      m.step(0x2673, 17); // call z,0x2673 taken -- award bonus
      m.call(0x2673);
    } else {
      m.step(0x1da4, 10);
    }
    regs.hl = 0xab64;
    m.step(0x1da7, 10);
    m.push16(0x1daa);
    m.step(0x1f1c, 17); // call 0x1f1c -- home-slot fill
    m.call(0x1f1c);
    regs.a = mem.read8(0x8134);
    m.step(0x1dad, 13);
    regs.and(regs.a);
    m.step(0x1dae, 4);
    if (regs.fZ) { m.step(0x1db9, 12); return block_1db9(); }
    m.step(0x1db0, 7);
    regs.b = 0x18;
    m.step(0x1db2, 7);
    m.push16(0x1db5);
    m.step(0x27cb, 17); // call 0x27cb
    m.call(0x27cb);
    regs.xor(regs.a);
    m.step(0x1db6, 4);
    mem.write8(0x8134, regs.a);
    m.step(0x1db9, 13);
    return block_1db9();
  }

  function block_1db9() {
    regs.a = mem.read8(0x83fd);
    m.step(0x1dbc, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x1dbd, 4);
    if (regs.fNZ) { m.step(0x1dce, 12); return block_1dce(); }
    m.step(0x1dbf, 7);
    regs.a = 0x01;
    m.step(0x1dc1, 7);
    mem.write8(0x825e, regs.a);
    m.step(0x1dc4, 13);
    regs.hl = 0x825c;
    m.step(0x1dc7, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x1dc8, 11); // inc (0x825c)
    m.ret();
  }

  function block_1dc9() {
    regs.a = mem.read8(0x8263);
    m.step(0x1dcc, 13);
    m.step(0x1d90, 12); // jr loc_1d90
    return block_1d90();
  }

  function block_1dce() {
    regs.a = 0x01;
    m.step(0x1dd0, 7);
    mem.write8(0x8263, regs.a);
    m.step(0x1dd3, 13);
    regs.hl = 0x825d;
    m.step(0x1dd6, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x1dd7, 11); // inc (0x825d)
    m.ret();
  }
}
