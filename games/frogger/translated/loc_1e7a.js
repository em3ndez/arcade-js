// SPDX-License-Identifier: GPL-3.0-only

// loc_1e7a  (ROM 0x1E7A-0x1ECA) — home-row handler row-4. Sibling of loc_1dd8: done-flag (0x8261)/P1,
// (0x8266)/P2; unless (0x8047)>=0x2a hands off to loc_1acb; award-points key (0x8121)==4; goal-scoring
// (loc_1f1c) slot 0xA924.
export function loc_1e7a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x1e7d, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1e7e, 4);
  if (regs.fNZ) {
    m.step(0x1ebc, 12); // jr nz,0x1ebc -- player 2
    regs.a = mem.read8(0x8266);
    m.step(0x1ebf, 13); // P2 done flag
    m.step(0x1e83, 12);
    return block_1e83();
  }
  m.step(0x1e80, 7);
  regs.a = mem.read8(0x8261);
  m.step(0x1e83, 13); // P1 done flag
  return block_1e83();

  function block_1e83() {
    regs.and(regs.a);
    m.step(0x1e84, 4);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x1e85, 5);
    regs.a = mem.read8(0x8047);
    m.step(0x1e88, 13);
    regs.cp(0x2a);
    m.step(0x1e8a, 7);
    if (regs.fNC) {
      m.step(0x1acb, 10);
      return m.call(0x1acb);
    }
    m.step(0x1e8d, 10);
    regs.b = 0xa8;
    m.step(0x1e8f, 7);
    regs.a = mem.read8(0x8121);
    m.step(0x1e92, 13);
    regs.sub(0x04);
    m.step(0x1e94, 7);
    if (regs.fZ) {
      m.push16(0x1e97);
      m.step(0x2673, 17);
      m.call(0x2673); // award points when (0x8121)==4
    } else {
      m.step(0x1e97, 10);
    }
    regs.hl = 0xa924;
    m.step(0x1e9a, 10);
    m.push16(0x1e9d);
    m.step(0x1f1c, 17);
    m.call(0x1f1c);
    regs.a = mem.read8(0x8134);
    m.step(0x1e9d, 13);
    regs.and(regs.a);
    m.step(0x1ea0, 4);
    if (regs.fZ) {
      m.step(0x1eac, 12);
      return block_1eac();
    }
    m.step(0x1ea3, 7);
    regs.b = 0xa8;
    m.step(0x1ea5, 7);
    m.push16(0x1ea8);
    m.step(0x27cb, 17);
    m.call(0x27cb);
    regs.xor(regs.a);
    m.step(0x1ea8, 4);
    mem.write8(0x8134, regs.a);
    m.step(0x1eac, 13);
    return block_1eac();
  }

  function block_1eac() {
    regs.a = mem.read8(0x83fd);
    m.step(0x1eaf, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x1eb0, 4);
    if (regs.fNZ) {
      m.step(0x1ec1, 12); // player 2
      regs.a = 0x01;
      m.step(0x1ec3, 7);
      mem.write8(0x8266, regs.a);
      m.step(0x1ec6, 13); // P2 done flag = 1
      regs.hl = 0x825d;
      m.step(0x1ec9, 10);
      regs.incMem8(mem, regs.hl);
      m.step(0x1eca, 11);
      m.ret();
      return;
    }
    m.step(0x1eb2, 7);
    regs.a = 0x01;
    m.step(0x1eb4, 7);
    mem.write8(0x8261, regs.a);
    m.step(0x1eb7, 13); // P1 done flag = 1
    regs.hl = 0x825c;
    m.step(0x1eba, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x1ebb, 11);
    m.ret();
  }
}

// loc_1ecb  (ROM 0x1ECB-0x1F1B) — home-row handler row-5. Sibling of loc_1dd8: done-flag (0x8262)/P1,
// (0x8267)/P2; award-points key (0x8121)==5; goal-scoring slot 0xA864.
export function loc_1ecb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x1ece, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1ecf, 4);
  if (regs.fNZ) {
    m.step(0x1f0d, 12); // jr nz,0x1f0d -- player 2
    regs.a = mem.read8(0x8267);
    m.step(0x1f10, 13); // P2 done flag
    m.step(0x1ed4, 12);
    return block_1ed4();
  }
  m.step(0x1ed1, 7);
  regs.a = mem.read8(0x8262);
  m.step(0x1ed4, 13); // P1 done flag
  return block_1ed4();

  function block_1ed4() {
    regs.and(regs.a);
    m.step(0x1ed5, 4);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x1ed6, 5);
    regs.a = mem.read8(0x8047);
    m.step(0x1ed9, 13);
    regs.cp(0x2a);
    m.step(0x1edb, 7);
    if (regs.fNC) {
      m.step(0x1acb, 10);
      return m.call(0x1acb);
    }
    m.step(0x1ede, 10);
    regs.b = 0xd8;
    m.step(0x1ee0, 7);
    regs.a = mem.read8(0x8121);
    m.step(0x1ee3, 13);
    regs.sub(0x05);
    m.step(0x1ee5, 7);
    if (regs.fZ) {
      m.push16(0x1ee8);
      m.step(0x2673, 17);
      m.call(0x2673); // award points when (0x8121)==5
    } else {
      m.step(0x1ee8, 10);
    }
    regs.hl = 0xa864;
    m.step(0x1eeb, 10);
    m.push16(0x1eee);
    m.step(0x1f1c, 17);
    m.call(0x1f1c);
    regs.a = mem.read8(0x8134);
    m.step(0x1eee, 13);
    regs.and(regs.a);
    m.step(0x1ef1, 4);
    if (regs.fZ) {
      m.step(0x1efd, 12);
      return block_1efd();
    }
    m.step(0x1ef4, 7);
    regs.b = 0xd8;
    m.step(0x1ef6, 7);
    m.push16(0x1ef9);
    m.step(0x27cb, 17);
    m.call(0x27cb);
    regs.xor(regs.a);
    m.step(0x1ef9, 4);
    mem.write8(0x8134, regs.a);
    m.step(0x1efd, 13);
    return block_1efd();
  }

  function block_1efd() {
    regs.a = mem.read8(0x83fd);
    m.step(0x1f00, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x1f01, 4);
    if (regs.fNZ) {
      m.step(0x1f12, 12); // player 2
      regs.a = 0x01;
      m.step(0x1f14, 7);
      mem.write8(0x8267, regs.a);
      m.step(0x1f17, 13); // P2 done flag = 1
      regs.hl = 0x825d;
      m.step(0x1f1a, 10);
      regs.incMem8(mem, regs.hl);
      m.step(0x1f1b, 11);
      m.ret();
      return;
    }
    m.step(0x1f03, 7);
    regs.a = 0x01;
    m.step(0x1f05, 7);
    mem.write8(0x8262, regs.a);
    m.step(0x1f08, 13); // P1 done flag = 1
    regs.hl = 0x825c;
    m.step(0x1f0b, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x1f0c, 11);
    m.ret();
  }
}
