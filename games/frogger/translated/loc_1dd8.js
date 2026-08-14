// SPDX-License-Identifier: GPL-3.0-only

// loc_1dd8  (ROM 0x1DD8-0x1E28) — home-row handler row-2. Per-player done-flag at (0x825F)/P1,
// (0x8264)/P2: if already set ret; else, unless (0x8047)>=0x2a hands off to loc_1acb, award points
// (loc_2673) when (0x8121)==2, run goal scoring (loc_1f1c) at slot 0xAAA4, and mark the flag.
export function loc_1dd8(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x1ddb, 13); // active player number
  regs.a = regs.dec8(regs.a);
  m.step(0x1ddc, 4);
  if (regs.fNZ) {
    m.step(0x1e1a, 12); // jr nz,0x1e1a -- player 2
    regs.a = mem.read8(0x8264);
    m.step(0x1e1d, 13); // P2 done flag
    m.step(0x1de1, 12);
    return block_1de1();
  }
  m.step(0x1dde, 7);
  regs.a = mem.read8(0x825f);
  m.step(0x1de1, 13); // P1 done flag
  return block_1de1();

  function block_1de1() {
    regs.and(regs.a);
    m.step(0x1de2, 4);
    if (regs.fNZ) {
      m.ret(11); // ret nz -- already done this row
      return;
    }
    m.step(0x1de3, 5);
    regs.a = mem.read8(0x8047);
    m.step(0x1de6, 13);
    regs.cp(0x2a);
    m.step(0x1de8, 7);
    if (regs.fNC) {
      m.step(0x1acb, 10);
      return m.call(0x1acb); // jp nc,0x1acb -- reject, back to input scan
    }
    m.step(0x1deb, 10);
    regs.b = 0x48;
    m.step(0x1ded, 7);
    regs.a = mem.read8(0x8121);
    m.step(0x1df0, 13);
    regs.sub(0x02);
    m.step(0x1df2, 7);
    if (regs.fZ) {
      m.push16(0x1df5);
      m.step(0x2673, 17);
      m.call(0x2673); // call z,0x2673 -- award points when (0x8121)==2
    } else {
      m.step(0x1df5, 10);
    }
    regs.hl = 0xaaa4;
    m.step(0x1df8, 10); // home slot video address
    m.push16(0x1dfb);
    m.step(0x1f1c, 17);
    m.call(0x1f1c); // goal scoring + reset
    regs.a = mem.read8(0x8134);
    m.step(0x1dfe, 13);
    regs.and(regs.a);
    m.step(0x1dff, 4);
    if (regs.fZ) {
      m.step(0x1e0a, 12);
      return block_1e0a();
    }
    m.step(0x1e01, 7);
    regs.b = 0x48;
    m.step(0x1e03, 7);
    m.push16(0x1e06);
    m.step(0x27cb, 17);
    m.call(0x27cb);
    regs.xor(regs.a);
    m.step(0x1e07, 4);
    mem.write8(0x8134, regs.a);
    m.step(0x1e0a, 13);
    return block_1e0a();
  }

  function block_1e0a() {
    regs.a = mem.read8(0x83fd);
    m.step(0x1e0d, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x1e0e, 4);
    if (regs.fNZ) {
      m.step(0x1e1f, 12); // jr nz,0x1e1f -- player 2
      regs.a = 0x01;
      m.step(0x1e21, 7);
      mem.write8(0x8264, regs.a);
      m.step(0x1e24, 13); // P2 done flag = 1
      regs.hl = 0x825d;
      m.step(0x1e27, 10);
      regs.incMem8(mem, regs.hl);
      m.step(0x1e28, 11); // (0x825d)++
      m.ret();
      return;
    }
    m.step(0x1e10, 7);
    regs.a = 0x01;
    m.step(0x1e12, 7);
    mem.write8(0x825f, regs.a);
    m.step(0x1e15, 13); // P1 done flag = 1
    regs.hl = 0x825c;
    m.step(0x1e18, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x1e19, 11); // (0x825c)++
    m.ret();
  }
}

// loc_1e29  (ROM 0x1E29-0x1E79) — home-row handler row-3. Sibling of loc_1dd8: done-flag (0x8260)/P1,
// (0x8265)/P2; award-points key (0x8121)==3; goal-scoring slot 0xA9E4.
export function loc_1e29(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x1e2c, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1e2d, 4);
  if (regs.fNZ) {
    m.step(0x1e6b, 12); // jr nz,0x1e6b -- player 2
    regs.a = mem.read8(0x8265);
    m.step(0x1e6e, 13); // P2 done flag
    m.step(0x1e32, 12);
    return block_1e32();
  }
  m.step(0x1e2f, 7);
  regs.a = mem.read8(0x8260);
  m.step(0x1e32, 13); // P1 done flag
  return block_1e32();

  function block_1e32() {
    regs.and(regs.a);
    m.step(0x1e33, 4);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x1e34, 5);
    regs.a = mem.read8(0x8047);
    m.step(0x1e37, 13);
    regs.cp(0x2a);
    m.step(0x1e39, 7);
    if (regs.fNC) {
      m.step(0x1acb, 10);
      return m.call(0x1acb);
    }
    m.step(0x1e3c, 10);
    regs.b = 0x78;
    m.step(0x1e3e, 7);
    regs.a = mem.read8(0x8121);
    m.step(0x1e41, 13);
    regs.sub(0x03);
    m.step(0x1e43, 7);
    if (regs.fZ) {
      m.push16(0x1e46);
      m.step(0x2673, 17);
      m.call(0x2673); // award points when (0x8121)==3
    } else {
      m.step(0x1e46, 10);
    }
    regs.hl = 0xa9e4;
    m.step(0x1e49, 10);
    m.push16(0x1e4c);
    m.step(0x1f1c, 17);
    m.call(0x1f1c);
    regs.a = mem.read8(0x8134);
    m.step(0x1e4c, 13);
    regs.and(regs.a);
    m.step(0x1e4f, 4);
    if (regs.fZ) {
      m.step(0x1e5b, 12);
      return block_1e5b();
    }
    m.step(0x1e52, 7);
    regs.b = 0x78;
    m.step(0x1e54, 7);
    m.push16(0x1e57);
    m.step(0x27cb, 17);
    m.call(0x27cb);
    regs.xor(regs.a);
    m.step(0x1e57, 4);
    mem.write8(0x8134, regs.a);
    m.step(0x1e5b, 13);
    return block_1e5b();
  }

  function block_1e5b() {
    regs.a = mem.read8(0x83fd);
    m.step(0x1e5e, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x1e5f, 4);
    if (regs.fNZ) {
      m.step(0x1e70, 12); // player 2
      regs.a = 0x01;
      m.step(0x1e72, 7);
      mem.write8(0x8265, regs.a);
      m.step(0x1e75, 13); // P2 done flag = 1
      regs.hl = 0x825d;
      m.step(0x1e78, 10);
      regs.incMem8(mem, regs.hl);
      m.step(0x1e79, 11);
      m.ret();
      return;
    }
    m.step(0x1e61, 7);
    regs.a = 0x01;
    m.step(0x1e63, 7);
    mem.write8(0x8260, regs.a);
    m.step(0x1e66, 13); // P1 done flag = 1
    regs.hl = 0x825c;
    m.step(0x1e69, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x1e6a, 11);
    m.ret();
  }
}
