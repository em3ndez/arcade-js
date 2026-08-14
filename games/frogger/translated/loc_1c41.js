// SPDX-License-Identifier: GPL-3.0-only

// loc_1c41  (ROM 0x1C41-0x1CFE) — river-ride HORIZONTAL object handlers, dispatched from loc_1acb.
// Four entries share this range: loc_1c41/loc_1ca0 (start a move on lane state 0x8252/0x8253),
// loc_1c76/loc_1cd5 (advance/commit the move, also entered from 0x23c1). loc_1c41 falls through
// into loc_1c76, and loc_1ca0 into loc_1cd5, so each first half ends by delegating into its second.

export function loc_1c41(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8047);
  m.step(0x1c44, 13); // -- frog Y
  regs.cp(0x30);
  m.step(0x1c46, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x1c47, 5);
  regs.a = mem.read8(0x8044);
  m.step(0x1c4a, 13); // -- frog X
  regs.cp(0xe0);
  m.step(0x1c4c, 7);
  if (regs.fNC) { m.ret(11); return; }
  m.step(0x1c4d, 5);
  regs.a = mem.read8(0x8252);
  m.step(0x1c50, 13); // -- lane-2 ride counter
  regs.and(regs.a);
  m.step(0x1c51, 4);
  if (regs.fNZ) { m.step(0x1c63, 12); return block_1c63(); }
  m.step(0x1c53, 7);
  regs.a = 0x04;
  m.step(0x1c55, 7);
  m.push16(0x1c56);
  m.step(0x0018, 11); // rst 0x18
  m.call(0x0018);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1c57, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x1c58, 7);
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x1c59, 6);
  regs.cp(0xa1);
  m.step(0x1c5b, 7);
  if (regs.fZ) { m.step(0x1c70, 10); return block_1c70(); }
  m.step(0x1c5e, 10);
  regs.a = 0xa1;
  m.step(0x1c60, 7);
  mem.write8(0x8045, regs.a);
  m.step(0x1c63, 13); // (0x8045) = 0xa1
  return block_1c63();

  function block_1c63() {
    regs.a = mem.read8(0x8252);
    m.step(0x1c66, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x1c67, 4);
    mem.write8(0x8252, regs.a);
    m.step(0x1c6a, 13);
    regs.or(regs.a);
    m.step(0x1c6b, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x1c6c, 5);
    regs.xor(regs.a);
    m.step(0x1c6d, 4);
    mem.write8(0x8252, regs.a);
    m.step(0x1c70, 13);
    return block_1c70();
  }

  function block_1c70() {
    regs.a = mem.read8(0x8258);
    m.step(0x1c73, 13);
    mem.write8(0x8252, regs.a);
    m.step(0x1c76, 13);
    return m.call(0x1c76); // fall through into loc_1c76
  }
}

export function loc_1c76(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x824e);
  m.step(0x1c79, 13); // -- lane-2 arrived flag
  regs.and(regs.a);
  m.step(0x1c7a, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x1c7b, 5);
  regs.a = regs.inc8(regs.a);
  m.step(0x1c7c, 4);
  mem.write8(0x824a, regs.a);
  m.step(0x1c7f, 13);
  regs.a = mem.read8(0x8252);
  m.step(0x1c82, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1c83, 4);
  mem.write8(0x8252, regs.a);
  m.step(0x1c86, 13);
  if (regs.fNZ) { m.step(0x1c94, 10); return block_1c94(); }
  m.step(0x1c89, 10);
  mem.write8(0x824a, regs.a);
  m.step(0x1c8c, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x1c8d, 4);
  mem.write8(0x824e, regs.a);
  m.step(0x1c90, 13);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1c91, 6);
  mem.write8(regs.hl, 0xa1);
  m.step(0x1c93, 10); // (hl+1) = 0xa1 -- reset tile to home code
  m.ret();
  return;

  function block_1c94() {
    regs.a = mem.read8(0x8255);
    m.step(0x1c97, 13); // -- lane-2 scroll delta
    regs.b = regs.a;
    m.step(0x1c98, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x1c99, 7);
    regs.add(regs.b);
    m.step(0x1c9a, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x1c9b, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1c9c, 6);
    regs.a = 0x9f;
    m.step(0x1c9e, 7);
    mem.write8(regs.hl, regs.a);
    m.step(0x1c9f, 7);
    m.ret();
  }
}

export function loc_1ca0(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8047);
  m.step(0x1ca3, 13); // -- frog Y
  regs.cp(0x30);
  m.step(0x1ca5, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x1ca6, 5);
  regs.a = mem.read8(0x8044);
  m.step(0x1ca9, 13); // -- frog X
  regs.cp(0x20);
  m.step(0x1cab, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x1cac, 5);
  regs.a = mem.read8(0x8253);
  m.step(0x1caf, 13); // -- lane-3 ride counter
  regs.and(regs.a);
  m.step(0x1cb0, 4);
  if (regs.fNZ) { m.step(0x1cc2, 12); return block_1cc2(); }
  m.step(0x1cb2, 7);
  regs.a = 0x04;
  m.step(0x1cb4, 7);
  m.push16(0x1cb5);
  m.step(0x0018, 11); // rst 0x18
  m.call(0x0018);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1cb6, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x1cb7, 7);
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x1cb8, 6);
  regs.cp(0x21);
  m.step(0x1cba, 7);
  if (regs.fZ) { m.step(0x1ccf, 10); return block_1ccf(); }
  m.step(0x1cbd, 10);
  regs.a = 0x21;
  m.step(0x1cbf, 7);
  mem.write8(0x8045, regs.a);
  m.step(0x1cc2, 13); // (0x8045) = 0x21
  return block_1cc2();

  function block_1cc2() {
    regs.a = mem.read8(0x8253);
    m.step(0x1cc5, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x1cc6, 4);
    mem.write8(0x8253, regs.a);
    m.step(0x1cc9, 13);
    regs.or(regs.a);
    m.step(0x1cca, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x1ccb, 5);
    regs.xor(regs.a);
    m.step(0x1ccc, 4);
    mem.write8(0x8253, regs.a);
    m.step(0x1ccf, 13);
    return block_1ccf();
  }

  function block_1ccf() {
    regs.a = mem.read8(0x8259);
    m.step(0x1cd2, 13);
    mem.write8(0x8253, regs.a);
    m.step(0x1cd5, 13);
    return m.call(0x1cd5); // fall through into loc_1cd5
  }
}

export function loc_1cd5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x824f);
  m.step(0x1cd8, 13); // -- lane-3 arrived flag
  regs.and(regs.a);
  m.step(0x1cd9, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x1cda, 5);
  regs.a = regs.inc8(regs.a);
  m.step(0x1cdb, 4);
  mem.write8(0x824b, regs.a);
  m.step(0x1cde, 13);
  regs.a = mem.read8(0x8253);
  m.step(0x1ce1, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1ce2, 4);
  mem.write8(0x8253, regs.a);
  m.step(0x1ce5, 13);
  if (regs.fNZ) { m.step(0x1cf3, 10); return block_1cf3(); }
  m.step(0x1ce8, 10);
  mem.write8(0x824b, regs.a);
  m.step(0x1ceb, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x1cec, 4);
  mem.write8(0x824f, regs.a);
  m.step(0x1cef, 13);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1cf0, 6);
  mem.write8(regs.hl, 0x21);
  m.step(0x1cf2, 10); // (hl+1) = 0x21
  m.ret();
  return;

  function block_1cf3() {
    regs.a = mem.read8(0x8255);
    m.step(0x1cf6, 13);
    regs.b = regs.a;
    m.step(0x1cf7, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x1cf8, 7);
    regs.sub(regs.b);
    m.step(0x1cf9, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x1cfa, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1cfb, 6);
    regs.a = 0x1f;
    m.step(0x1cfd, 7);
    mem.write8(regs.hl, regs.a);
    m.step(0x1cfe, 7);
    m.ret();
  }
}
