// SPDX-License-Identifier: GPL-3.0-only

// loc_0870  (ROM 0x0870-0x08DF) — score-display driver. Guards on (0x83CD)/(0x8004); on first entry
// seeds (0x83AE) and queues tile 0x06 (rst 0x18); lays out the field (loc_0ABA); runs the (0x83DC)
// countdown that steps the (0x83DD)/(0x83DE) BCD pair and animates a tile at 0xA8DF. Two tail exits:
// jp z,0x085B (no more frogs) and, on the (0x83DF)!=0 arm via loc_08C5, a fall-through into loc_08E0.
export function loc_0870(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83cd);
  m.step(0x0873, 13);
  regs.or(regs.a);
  m.step(0x0874, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x0875, 5);
  regs.a = mem.read8(0x8004);
  m.step(0x0878, 13);
  regs.or(regs.a);
  m.step(0x0879, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x087a, 5);
  regs.a = mem.read8(0x83ae);
  m.step(0x087d, 13);
  regs.or(regs.a);
  m.step(0x087e, 4);
  if (regs.fNZ) {
    m.step(0x0887, 12);
    return block_0887();
  }
  m.step(0x0880, 7);
  regs.a = regs.inc8(regs.a);
  m.step(0x0881, 4);
  mem.write8(0x83ae, regs.a);
  m.step(0x0884, 13); // (0x83ae) = 1 -- first-entry seed
  regs.a = 0x06;
  m.step(0x0886, 7);
  m.push16(0x0887);
  m.step(0x0018, 11); // rst 0x18 -- A=0x06 tile-queue
  m.call(0x0018);
  return block_0887();

  function block_0887() {
    m.push16(0x088a);
    m.step(0x0aba, 17);
    m.call(0x0aba);
    regs.a = mem.read8(0x83df);
    m.step(0x088d, 13);
    regs.or(regs.a);
    m.step(0x088e, 4);
    if (regs.fNZ) {
      m.step(0x08c5, 12);
      return loc_08c5(m);
    }
    m.step(0x0890, 7);
    regs.hl = 0x83dc;
    m.step(0x0893, 10);
    regs.decMem8(mem, regs.hl);
    m.step(0x0894, 11); // dec (0x83dc) -- countdown
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x0895, 5);
    mem.write8(regs.hl, 0x20);
    m.step(0x0897, 10); // (0x83dc) = 0x20 -- reload
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0898, 6);
    regs.a = mem.read8(regs.hl);
    m.step(0x0899, 7); // (0x83dd)
    regs.or(regs.a);
    m.step(0x089a, 4);
    if (regs.fZ) {
      m.step(0x085b, 10);
      return m.call(0x085b); // jp z,0x085b -- no-more-frogs tail
    }
    m.step(0x089d, 10);
    regs.a = regs.dec8(regs.a);
    m.step(0x089e, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x089f, 7); // (0x83dd) -= 1
    regs.l = regs.inc8(regs.l);
    m.step(0x08a0, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x08a1, 7); // (0x83de)
    regs.a = regs.dec8(regs.a);
    m.step(0x08a2, 4);
    regs.daa();
    m.step(0x08a3, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x08a4, 7); // (0x83de) = BCD dec
    regs.l = regs.dec8(regs.l);
    m.step(0x08a5, 4);
    regs.cp(0x10);
    m.step(0x08a7, 7);
    if (regs.fNZ) {
      m.step(0x08b0, 12);
      return block_08b0();
    }
    m.step(0x08a9, 7);
    regs.a = 0x05;
    m.step(0x08ab, 7);
    m.push16(0x08ac);
    m.step(0x0018, 11); // rst 0x18 -- A=0x05 tile-queue
    m.call(0x0018);
    regs.xor(regs.a);
    m.step(0x08ad, 4);
    mem.write8(0x803f, regs.a);
    m.step(0x08b0, 13); // (0x803f) = 0
    return block_08b0();
  }

  function block_08b0() {
    regs.h = mem.read8(regs.hl);
    m.step(0x08b1, 7); // H = (0x83dd)
    regs.a = regs.h;
    m.step(0x08b2, 4);
    regs.and(0x03);
    m.step(0x08b4, 7);
    regs.c = regs.a;
    m.step(0x08b5, 4); // C = H & 0x03
    regs.xor(regs.h);
    m.step(0x08b6, 4);
    regs.rlca();
    m.step(0x08b7, 4);
    regs.rlca();
    m.step(0x08b8, 4);
    regs.l = regs.a;
    m.step(0x08b9, 4);
    regs.h = 0x00;
    m.step(0x08bb, 7);
    regs.addHl(regs.hl);
    m.step(0x08bc, 11);
    regs.de = 0xa8df;
    m.step(0x08bf, 10);
    regs.addHl(regs.de);
    m.step(0x08c0, 11); // HL = 0xa8df + 2*index
    regs.a = 0x10;
    m.step(0x08c2, 7);
    regs.sub(regs.c);
    m.step(0x08c3, 4); // A = 0x10 - C
    mem.write8(regs.hl, regs.a);
    m.step(0x08c4, 7);
    m.ret();
  }
}

// loc_08C5  (ROM 0x08C5-0x08DF) — the (0x83DF)!=0 arm of loc_0870, also a standalone call target
// (loc_1F1C does m.call(0x08C5)). Seeds (0x83E0), blits B=5 tiles 0x2F6E->0xAA51, then falls into loc_08E0.
export function loc_08c5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83e0);
  m.step(0x08c8, 13);
  regs.or(regs.a);
  m.step(0x08c9, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x08ca, 5);
  regs.a = regs.inc8(regs.a);
  m.step(0x08cb, 4);
  mem.write8(0x83e0, regs.a);
  m.step(0x08ce, 13); // (0x83e0) = 1
  regs.hl = 0xaa51;
  m.step(0x08d1, 10);
  regs.de = 0x2f6e;
  m.step(0x08d4, 10);
  regs.b = 0x05;
  m.step(0x08d6, 7);
  m.push16(0x08d7);
  m.step(0x0028, 11); // rst 0x28 -- blit B=5 from 0x2f6e to 0xaa51
  m.call(0x0028);
  regs.a = mem.read8(0x83de);
  m.step(0x08da, 13);
  regs.e = regs.a;
  m.step(0x08db, 4);
  regs.d = 0x00;
  m.step(0x08dd, 7); // DE = (0x83de)
  m.push16(0x08e0);
  m.step(0x0ba0, 17);
  m.call(0x0ba0);
  return m.call(0x08e0); // fall-through into loc_08e0
}
