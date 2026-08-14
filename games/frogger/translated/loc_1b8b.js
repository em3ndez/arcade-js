// SPDX-License-Identifier: GPL-3.0-only

// loc_1b8b  (ROM 0x1B8B-0x1C40) — river-ride VERTICAL object handlers, dispatched from loc_1acb.
// Four entries share this range: loc_1b8b/loc_1be4 (start a move on lane state 0x8250/0x8251),
// loc_1bba/loc_1c0d (advance/commit the move, also entered from 0x23c1). loc_1b8b falls through
// into loc_1bba, and loc_1be4 into loc_1c0d, so each first half ends by delegating into its second.

export function loc_1b8b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8047);
  m.step(0x1b8e, 13); // -- frog Y
  regs.cp(0xf0);
  m.step(0x1b90, 7);
  if (regs.fNC) { m.ret(11); return; }
  m.step(0x1b91, 5);
  regs.a = mem.read8(0x8250);
  m.step(0x1b94, 13); // -- lane-0 ride counter
  regs.and(regs.a);
  m.step(0x1b95, 4);
  if (regs.fNZ) { m.step(0x1ba7, 12); return block_1ba7(); }
  m.step(0x1b97, 7);
  regs.a = 0x04;
  m.step(0x1b99, 7);
  m.push16(0x1b9a);
  m.step(0x0018, 11); // rst 0x18
  m.call(0x0018);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1b9b, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x1b9c, 7);
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x1b9d, 6);
  regs.cp(0xde);
  m.step(0x1b9f, 7);
  if (regs.fZ) { m.step(0x1bb4, 10); return block_1bb4(); }
  m.step(0x1ba2, 10);
  regs.a = 0xde;
  m.step(0x1ba4, 7);
  mem.write8(0x8045, regs.a);
  m.step(0x1ba7, 13); // (0x8045) = 0xde
  return block_1ba7();

  function block_1ba7() {
    regs.a = mem.read8(0x8250);
    m.step(0x1baa, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x1bab, 4);
    mem.write8(0x8250, regs.a);
    m.step(0x1bae, 13);
    regs.or(regs.a);
    m.step(0x1baf, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x1bb0, 5);
    regs.xor(regs.a);
    m.step(0x1bb1, 4);
    mem.write8(0x8250, regs.a);
    m.step(0x1bb4, 13);
    return block_1bb4();
  }

  function block_1bb4() {
    regs.a = mem.read8(0x8256);
    m.step(0x1bb7, 13);
    mem.write8(0x8250, regs.a);
    m.step(0x1bba, 13);
    return m.call(0x1bba); // fall through into loc_1bba
  }
}

export function loc_1bba(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x824c);
  m.step(0x1bbd, 13); // -- lane-0 arrived flag
  regs.and(regs.a);
  m.step(0x1bbe, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x1bbf, 5);
  regs.a = regs.inc8(regs.a);
  m.step(0x1bc0, 4);
  mem.write8(0x8248, regs.a);
  m.step(0x1bc3, 13);
  regs.a = mem.read8(0x8250);
  m.step(0x1bc6, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1bc7, 4);
  mem.write8(0x8250, regs.a);
  m.step(0x1bca, 13);
  if (regs.fNZ) { m.step(0x1bd8, 10); return block_1bd8(); }
  m.step(0x1bcd, 10);
  mem.write8(0x8248, regs.a);
  m.step(0x1bd0, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x1bd1, 4);
  mem.write8(0x824c, regs.a);
  m.step(0x1bd4, 13);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1bd5, 6);
  mem.write8(regs.hl, 0xde);
  m.step(0x1bd7, 10); // (hl+1) = 0xde -- reset tile to home code
  m.ret();
  return;

  function block_1bd8() {
    regs.exDeHl();
    m.step(0x1bd9, 4);
    regs.a = mem.read8(0x8254);
    m.step(0x1bdc, 13); // -- lane-0 scroll delta
    regs.add(mem.read8(regs.hl));
    m.step(0x1bdd, 7);
    mem.write8(regs.hl, regs.a);
    m.step(0x1bde, 7);
    regs.exDeHl();
    m.step(0x1bdf, 4);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1be0, 6);
    regs.a = 0xdc;
    m.step(0x1be2, 7);
    mem.write8(regs.hl, regs.a);
    m.step(0x1be3, 7);
    m.ret();
  }
}

export function loc_1be4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8251);
  m.step(0x1be7, 13); // -- lane-1 ride counter
  regs.and(regs.a);
  m.step(0x1be8, 4);
  if (regs.fNZ) { m.step(0x1bfa, 12); return block_1bfa(); }
  m.step(0x1bea, 7);
  regs.a = 0x04;
  m.step(0x1bec, 7);
  m.push16(0x1bed);
  m.step(0x0018, 11); // rst 0x18
  m.call(0x0018);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1bee, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x1bef, 7);
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x1bf0, 6);
  regs.cp(0x1e);
  m.step(0x1bf2, 7);
  if (regs.fZ) { m.step(0x1c07, 10); return block_1c07(); }
  m.step(0x1bf5, 10);
  regs.a = 0x1e;
  m.step(0x1bf7, 7);
  mem.write8(0x8045, regs.a);
  m.step(0x1bfa, 13); // (0x8045) = 0x1e
  return block_1bfa();

  function block_1bfa() {
    regs.a = mem.read8(0x8251);
    m.step(0x1bfd, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x1bfe, 4);
    mem.write8(0x8251, regs.a);
    m.step(0x1c01, 13);
    regs.or(regs.a);
    m.step(0x1c02, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x1c03, 5);
    regs.xor(regs.a);
    m.step(0x1c04, 4);
    mem.write8(0x8251, regs.a);
    m.step(0x1c07, 13);
    return block_1c07();
  }

  function block_1c07() {
    regs.a = mem.read8(0x8257);
    m.step(0x1c0a, 13);
    mem.write8(0x8251, regs.a);
    m.step(0x1c0d, 13);
    return m.call(0x1c0d); // fall through into loc_1c0d
  }
}

export function loc_1c0d(m) {
  const { regs, mem } = m;

  m.push16(0x1c10);
  m.step(0x23eb, 17);
  m.call(0x23eb);
  regs.a = mem.read8(0x824d);
  m.step(0x1c13, 13); // -- lane-1 arrived flag
  regs.and(regs.a);
  m.step(0x1c14, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x1c15, 5);
  regs.a = regs.inc8(regs.a);
  m.step(0x1c16, 4);
  mem.write8(0x8249, regs.a);
  m.step(0x1c19, 13);
  regs.a = mem.read8(0x8251);
  m.step(0x1c1c, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1c1d, 4);
  mem.write8(0x8251, regs.a);
  m.step(0x1c20, 13);
  if (regs.fNZ) { m.step(0x1c33, 10); return block_1c33(); }
  m.step(0x1c23, 10);
  mem.write8(0x8249, regs.a);
  m.step(0x1c26, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x1c27, 4);
  mem.write8(0x824d, regs.a);
  m.step(0x1c2a, 13);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1c2b, 6);
  mem.write8(regs.hl, 0x1e);
  m.step(0x1c2d, 10); // (hl+1) = 0x1e
  m.push16(regs.de);
  m.step(0x1c2e, 11);
  m.push16(0x1c31);
  m.step(0x1fd6, 17);
  m.call(0x1fd6);
  regs.de = m.pop16();
  m.step(0x1c32, 10);
  m.ret();
  return;

  function block_1c33() {
    regs.exDeHl();
    m.step(0x1c34, 4);
    regs.a = mem.read8(0x8254);
    m.step(0x1c37, 13);
    regs.b = regs.a;
    m.step(0x1c38, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x1c39, 7);
    regs.sub(regs.b);
    m.step(0x1c3a, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x1c3b, 7);
    regs.exDeHl();
    m.step(0x1c3c, 4);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1c3d, 6);
    regs.a = 0x1c;
    m.step(0x1c3f, 7);
    mem.write8(regs.hl, regs.a);
    m.step(0x1c40, 7);
    m.ret();
  }
}
