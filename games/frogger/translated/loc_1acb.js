// SPDX-License-Identifier: GPL-3.0-only

// loc_1acb  (ROM 0x1ACB-0x1B8A) — frog input scan. Gated by (0x826C); a hop-timer (0x8268) decrements
// and rets. Otherwise, when (0x8004)==0, reads joystick ports (0xE000/0xE002/0xE004), clears the pending
// direction/ride flags (0x824C-0x824F, 0x8250-0x8253), and cp/bit-dispatches by lane state (0x8248-0x824B)
// to the eight ride/move handlers 0x1b8b/1bba/1be4/1c0d/1c41/1c76/1ca0/1cd5.
export function loc_1acb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x826c);
  m.step(0x1ace, 13);
  regs.and(regs.a);
  m.step(0x1acf, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x1ad0, 5);
  regs.a = mem.read8(0x8268);
  m.step(0x1ad3, 13);
  regs.and(regs.a);
  m.step(0x1ad4, 4);
  if (regs.fZ) {
    m.step(0x1ade, 12);
    return block_1ade();
  }
  m.step(0x1ad6, 7);
  regs.a = regs.dec8(regs.a);
  m.step(0x1ad7, 4);
  mem.write8(0x8268, regs.a);
  m.step(0x1ada, 13);
  m.push16(0x1add);
  m.step(0x23eb, 17);
  m.call(0x23eb);
  m.ret();
  return;

  function block_1ade() {
    regs.a = mem.read8(0x8004);
    m.step(0x1ae1, 13);
    regs.and(regs.a);
    m.step(0x1ae2, 4);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x1ae3, 5);
    regs.hl = 0x8044;
    m.step(0x1ae6, 10);
    regs.de = 0x8047;
    m.step(0x1ae9, 10);
    regs.a = mem.read8(0xe004);
    m.step(0x1aec, 13);
    regs.bit(3, regs.a);
    m.step(0x1aee, 8);
    if (regs.fZ) {
      m.step(0x1af7, 12);
      return block_1af7();
    }
    m.step(0x1af0, 7);
    regs.a = mem.read8(0x83fd);
    m.step(0x1af3, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x1af4, 4);
    if (regs.fNZ) {
      m.step(0x1b74, 10);
      return block_1b74();
    }
    m.step(0x1af7, 10);
    return block_1af7();
  }

  function block_1af7() {
    regs.a = mem.read8(0xe000);
    m.step(0x1afa, 13);
    regs.c = regs.a;
    m.step(0x1afb, 4);
    return block_1afb();
  }

  function block_1afb() {
    regs.a = mem.read8(0x8248);
    m.step(0x1afe, 13);
    regs.and(regs.a);
    m.step(0x1aff, 4);
    if (regs.fNZ) {
      m.step(0x1bba, 10);
      return m.call(0x1bba);
    }
    m.step(0x1b02, 10);
    regs.a = mem.read8(0xe004);
    m.step(0x1b05, 13);
    regs.bit(3, regs.a);
    m.step(0x1b07, 8);
    if (regs.fZ) {
      m.step(0x1b10, 12);
      return block_1b10();
    }
    m.step(0x1b09, 7);
    regs.a = mem.read8(0x83fd);
    m.step(0x1b0c, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x1b0d, 4);
    if (regs.fNZ) {
      m.step(0x1b7b, 10);
      return block_1b7b();
    }
    m.step(0x1b10, 10);
    return block_1b10();
  }

  function block_1b10() {
    regs.a = mem.read8(0xe004);
    m.step(0x1b13, 13);
    regs.bit(6, regs.a);
    m.step(0x1b15, 8);
    return block_1b15();
  }

  function block_1b15() {
    if (regs.fZ) {
      m.step(0x1b8b, 10);
      return m.call(0x1b8b);
    }
    m.step(0x1b18, 10);
    regs.xor(regs.a);
    m.step(0x1b19, 4);
    mem.write8(0x824c, regs.a);
    m.step(0x1b1c, 13);
    mem.write8(0x8250, regs.a);
    m.step(0x1b1f, 13);
    regs.a = mem.read8(0x8249);
    m.step(0x1b22, 13);
    regs.and(regs.a);
    m.step(0x1b23, 4);
    if (regs.fNZ) {
      m.step(0x1c0d, 10);
      return m.call(0x1c0d);
    }
    m.step(0x1b26, 10);
    regs.a = mem.read8(0x824a);
    m.step(0x1b29, 13);
    regs.b = regs.a;
    m.step(0x1b2a, 4);
    regs.a = mem.read8(0x824b);
    m.step(0x1b2d, 13);
    regs.add(regs.b);
    m.step(0x1b2e, 4);
    if (regs.fNZ) {
      m.step(0x1b4d, 12);
      return block_1b4d();
    }
    m.step(0x1b30, 7);
    regs.a = mem.read8(0xe004);
    m.step(0x1b33, 13);
    regs.bit(3, regs.a);
    m.step(0x1b35, 8);
    if (regs.fZ) {
      m.step(0x1b3e, 12);
      return block_1b3e();
    }
    m.step(0x1b37, 7);
    regs.a = mem.read8(0x83fd);
    m.step(0x1b3a, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x1b3b, 4);
    if (regs.fNZ) {
      m.step(0x1b83, 10);
      return block_1b83();
    }
    m.step(0x1b3e, 10);
    return block_1b3e();
  }

  function block_1b3e() {
    regs.a = mem.read8(0xe004);
    m.step(0x1b41, 13);
    regs.bit(4, regs.a);
    m.step(0x1b43, 8);
    return block_1b43();
  }

  function block_1b43() {
    if (regs.fZ) {
      m.step(0x1be4, 10);
      return m.call(0x1be4);
    }
    m.step(0x1b46, 10);
    regs.xor(regs.a);
    m.step(0x1b47, 4);
    mem.write8(0x824d, regs.a);
    m.step(0x1b4a, 13);
    mem.write8(0x8251, regs.a);
    m.step(0x1b4d, 13);
    return block_1b4d();
  }

  function block_1b4d() {
    regs.a = mem.read8(0x824a);
    m.step(0x1b50, 13);
    regs.and(regs.a);
    m.step(0x1b51, 4);
    if (regs.fNZ) {
      m.step(0x1c76, 10);
      return m.call(0x1c76);
    }
    m.step(0x1b54, 10);
    regs.bit(4, regs.c);
    m.step(0x1b56, 8);
    if (regs.fZ) {
      m.step(0x1c41, 10);
      return m.call(0x1c41);
    }
    m.step(0x1b59, 10);
    regs.xor(regs.a);
    m.step(0x1b5a, 4);
    mem.write8(0x824e, regs.a);
    m.step(0x1b5d, 13);
    mem.write8(0x8252, regs.a);
    m.step(0x1b60, 13);
    regs.a = mem.read8(0x824b);
    m.step(0x1b63, 13);
    regs.and(regs.a);
    m.step(0x1b64, 4);
    if (regs.fNZ) {
      m.step(0x1cd5, 10);
      return m.call(0x1cd5);
    }
    m.step(0x1b67, 10);
    regs.bit(5, regs.c);
    m.step(0x1b69, 8);
    if (regs.fZ) {
      m.step(0x1ca0, 10);
      return m.call(0x1ca0);
    }
    m.step(0x1b6c, 10);
    regs.xor(regs.a);
    m.step(0x1b6d, 4);
    mem.write8(0x824f, regs.a);
    m.step(0x1b70, 13);
    mem.write8(0x8253, regs.a);
    m.step(0x1b73, 13);
    m.ret();
  }

  function block_1b74() {
    regs.a = mem.read8(0xe002);
    m.step(0x1b77, 13);
    regs.c = regs.a;
    m.step(0x1b78, 4);
    m.step(0x1afb, 10);
    return block_1afb();
  }

  function block_1b7b() {
    regs.a = mem.read8(0xe004);
    m.step(0x1b7e, 13);
    regs.bit(0, regs.a);
    m.step(0x1b80, 8);
    m.step(0x1b15, 10);
    return block_1b15();
  }

  function block_1b83() {
    regs.a = mem.read8(0xe000);
    m.step(0x1b86, 13);
    regs.bit(0, regs.a);
    m.step(0x1b88, 8);
    m.step(0x1b43, 10);
    return block_1b43();
  }
}
