// SPDX-License-Identifier: GPL-3.0-only

// loc_1a55  (ROM 0x1A55-0x1ACA) — master collision/scoring orchestrator. When (0x83FE)!=0 it runs the
// per-frame sub-engines (0x28bb/291d/27ea/26a6/2906), an interior timing helper at 0x1a9f gated by
// (0x8340), a scroll-timer helper via (0x83b7).bit0 (interior 0x1aad or the 0x1a7c inline arm on
// (0x8122)), then at 0x1a8f tails to loc_1cff (frog-Y row scan, (0x8047)<0x31) or loc_1acb (input scan).
export function loc_1a55(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fe);
  m.step(0x1a58, 13);
  regs.or(regs.a);
  m.step(0x1a59, 4);
  if (regs.fZ) {
    m.step(0x1a8f, 12);
    return block_1a8f();
  }
  m.step(0x1a5b, 7);

  m.push16(0x1a5e);
  m.step(0x28bb, 17);
  m.call(0x28bb);
  m.push16(0x1a61);
  m.step(0x291d, 17);
  m.call(0x291d);
  m.push16(0x1a64);
  m.step(0x27ea, 17);
  m.call(0x27ea);
  m.push16(0x1a67);
  m.step(0x26a6, 17);
  m.call(0x26a6);
  m.push16(0x1a6a);
  m.step(0x2906, 17);
  m.call(0x2906);

  regs.a = mem.read8(0x8340);
  m.step(0x1a6d, 13);
  regs.and(regs.a);
  m.step(0x1a6e, 4);
  if (regs.fNZ) {
    m.push16(0x1a71);
    m.step(0x1a9f, 17); // call nz,0x1a9f -- interior helper, rets to 0x1a71
    block_1a9f();
  } else {
    m.step(0x1a71, 10);
  }

  m.push16(0x1a74);
  m.step(0x23eb, 17);
  m.call(0x23eb);

  regs.a = mem.read8(0x83b7);
  m.step(0x1a77, 13);
  regs.bit(0, regs.a);
  m.step(0x1a79, 8);
  if (regs.fZ) {
    m.step(0x1aad, 10);
    return block_1aad();
  }
  m.step(0x1a7c, 10);

  regs.a = mem.read8(0x8122);
  m.step(0x1a7f, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x1a80, 4);
  mem.write8(0x8122, regs.a);
  m.step(0x1a83, 13);
  regs.and(regs.a);
  m.step(0x1a84, 4);
  if (regs.fZ) {
    m.push16(0x1a87);
    m.step(0x23fa, 17);
    m.call(0x23fa);
  } else {
    m.step(0x1a87, 10);
  }

  regs.a = mem.read8(0x8122);
  m.step(0x1a8a, 13);
  regs.cp(0x70);
  m.step(0x1a8c, 7);
  if (regs.fZ) {
    m.push16(0x1a8f);
    m.step(0x25ce, 17);
    m.call(0x25ce);
  } else {
    m.step(0x1a8f, 10);
  }
  return block_1a8f();

  function block_1a8f() {
    regs.a = mem.read8(0x8047);
    m.step(0x1a92, 13);
    regs.cp(0x31);
    m.step(0x1a94, 7);
    if (regs.fC) {
      m.step(0x1cff, 10);
      return m.call(0x1cff); // jp c,0x1cff -- tail to the frog-Y row scan
    }
    m.step(0x1a97, 10);
    regs.a = mem.read8(0x83fe);
    m.step(0x1a9a, 13);
    regs.or(regs.a);
    m.step(0x1a9b, 4);
    if (regs.fZ) {
      m.ret(11);
      return;
    }
    m.step(0x1a9c, 5);
    m.step(0x1acb, 10);
    return m.call(0x1acb); // jp 0x1acb -- tail to the input scan
  }

  function block_1a9f() {
    regs.a = regs.dec8(regs.a);
    m.step(0x1aa0, 4);
    mem.write8(0x8340, regs.a);
    m.step(0x1aa3, 13);
    regs.cp(0x01);
    m.step(0x1aa5, 7);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x1aa6, 5);
    m.push16(0x1aa9);
    m.step(0x269a, 17);
    m.call(0x269a);
    m.push16(0x1aac);
    m.step(0x27de, 17);
    m.call(0x27de);
    m.ret();
  }

  function block_1aad() {
    regs.a = mem.read8(0x8122);
    m.step(0x1ab0, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x1ab1, 4);
    mem.write8(0x8122, regs.a);
    m.step(0x1ab4, 13);
    regs.and(regs.a);
    m.step(0x1ab5, 4);
    if (regs.fZ) {
      m.push16(0x1ab8);
      m.step(0x2496, 17);
      m.call(0x2496);
    } else {
      m.step(0x1ab8, 10);
    }
    regs.a = mem.read8(0x8122);
    m.step(0x1abb, 13);
    regs.cp(0x50);
    m.step(0x1abd, 7);
    if (regs.fZ) {
      m.push16(0x1ac0);
      m.step(0x2532, 17);
      m.call(0x2532);
    } else {
      m.step(0x1ac0, 10);
    }
    regs.a = mem.read8(0x8122);
    m.step(0x1ac3, 13);
    regs.cp(0xb0);
    m.step(0x1ac5, 7);
    if (regs.fZ) {
      m.push16(0x1ac8);
      m.step(0x25ce, 17);
      m.call(0x25ce);
    } else {
      m.step(0x1ac8, 10);
    }
    m.step(0x1a8f, 10);
    return block_1a8f();
  }
}
