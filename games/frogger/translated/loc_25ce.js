// SPDX-License-Identifier: GPL-3.0-only

// loc_25ce  (ROM 0x25CE-0x2672) — board/home-marker reset: dispatch on (0x8121) 1..5 to one of five
// per-slot arms; each arm gates on its own timer/flag pair and, when clear, stamps tile 0x10 into that
// slot's 2x2 home cell via the shared tail (block_2658), then clears (0x8121)/(0x8120).
export function loc_25ce(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x25d1, 13);
  regs.c = regs.a;
  m.step(0x25d2, 4);
  regs.a = mem.read8(0x8121);
  m.step(0x25d5, 13); // A = the slot selector 1..5

  regs.cp(0x01);
  m.step(0x25d7, 7);
  if (regs.fZ) { m.step(0x25ef, 10); return block_25ef(); }
  m.step(0x25da, 10);
  regs.cp(0x02);
  m.step(0x25dc, 7);
  if (regs.fZ) { m.step(0x2604, 10); return block_2604(); }
  m.step(0x25df, 10);
  regs.cp(0x03);
  m.step(0x25e1, 7);
  if (regs.fZ) { m.step(0x2619, 10); return block_2619(); }
  m.step(0x25e4, 10);
  regs.cp(0x04);
  m.step(0x25e6, 7);
  if (regs.fZ) { m.step(0x262e, 10); return block_262e(); }
  m.step(0x25e9, 10);
  regs.cp(0x05);
  m.step(0x25eb, 7);
  if (regs.fZ) { m.step(0x2643, 10); return block_2643(); }
  m.step(0x25ee, 10);
  m.ret();

  // slot 1
  function block_25ef() {
    regs.c = regs.dec8(regs.c);
    m.step(0x25f0, 4);
    if (regs.fNZ) { m.step(0x25fd, 12); return block_25fd(); }
    m.step(0x25f2, 7);
    regs.a = mem.read8(0x825e);
    m.step(0x25f5, 13);
    regs.and(regs.a);
    m.step(0x25f6, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x25f7, 5);
    return block_25f7();
  }
  function block_25f7() {
    regs.hl = 0xab64;
    m.step(0x25fa, 10);
    m.step(0x2658, 10);
    return block_2658();
  }
  function block_25fd() {
    regs.a = mem.read8(0x8263);
    m.step(0x2600, 13);
    regs.and(regs.a);
    m.step(0x2601, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2602, 5);
    m.step(0x25f7, 12);
    return block_25f7();
  }

  // slot 2
  function block_2604() {
    regs.c = regs.dec8(regs.c);
    m.step(0x2605, 4);
    if (regs.fNZ) { m.step(0x2612, 12); return block_2612(); }
    m.step(0x2607, 7);
    regs.a = mem.read8(0x825f);
    m.step(0x260a, 13);
    regs.and(regs.a);
    m.step(0x260b, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x260c, 5);
    return block_260c();
  }
  function block_260c() {
    regs.hl = 0xaaa4;
    m.step(0x260f, 10);
    m.step(0x2658, 10);
    return block_2658();
  }
  function block_2612() {
    regs.a = mem.read8(0x8264);
    m.step(0x2615, 13);
    regs.and(regs.a);
    m.step(0x2616, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2617, 5);
    m.step(0x260c, 12);
    return block_260c();
  }

  // slot 3
  function block_2619() {
    regs.c = regs.dec8(regs.c);
    m.step(0x261a, 4);
    if (regs.fNZ) { m.step(0x2627, 12); return block_2627(); }
    m.step(0x261c, 7);
    regs.a = mem.read8(0x8260);
    m.step(0x261f, 13);
    regs.and(regs.a);
    m.step(0x2620, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2621, 5);
    return block_2621();
  }
  function block_2621() {
    regs.hl = 0xa9e4;
    m.step(0x2624, 10);
    m.step(0x2658, 10);
    return block_2658();
  }
  function block_2627() {
    regs.a = mem.read8(0x8265);
    m.step(0x262a, 13);
    regs.and(regs.a);
    m.step(0x262b, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x262c, 5);
    m.step(0x2621, 12);
    return block_2621();
  }

  // slot 4
  function block_262e() {
    regs.c = regs.dec8(regs.c);
    m.step(0x262f, 4);
    if (regs.fNZ) { m.step(0x263c, 12); return block_263c(); }
    m.step(0x2631, 7);
    regs.a = mem.read8(0x8261);
    m.step(0x2634, 13);
    regs.and(regs.a);
    m.step(0x2635, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2636, 5);
    return block_2636();
  }
  function block_2636() {
    regs.hl = 0xa924;
    m.step(0x2639, 10);
    m.step(0x2658, 10);
    return block_2658();
  }
  function block_263c() {
    regs.a = mem.read8(0x8266);
    m.step(0x263f, 13);
    regs.and(regs.a);
    m.step(0x2640, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2641, 5);
    m.step(0x2636, 12);
    return block_2636();
  }

  // slot 5
  function block_2643() {
    regs.c = regs.dec8(regs.c);
    m.step(0x2644, 4);
    if (regs.fNZ) { m.step(0x2651, 12); return block_2651(); }
    m.step(0x2646, 7);
    regs.a = mem.read8(0x8262);
    m.step(0x2649, 13);
    regs.and(regs.a);
    m.step(0x264a, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x264b, 5);
    return block_264b();
  }
  function block_264b() {
    regs.hl = 0xa864;
    m.step(0x264e, 10);
    m.step(0x2658, 10);
    return block_2658();
  }
  function block_2651() {
    regs.a = mem.read8(0x8267);
    m.step(0x2654, 13);
    regs.and(regs.a);
    m.step(0x2655, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2656, 5);
    m.step(0x264b, 12);
    return block_264b();
  }

  // shared tail: stamp the 2x2 home cell (tile 0x10) at HL and HL+0x1f row, then clear the selector
  function block_2658() {
    mem.write8(regs.hl, 0x10);
    m.step(0x265a, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x265b, 6);
    mem.write8(regs.hl, 0x10);
    m.step(0x265d, 10);
    regs.bc = 0x001f;
    m.step(0x2660, 10);
    regs.addHl(regs.bc);
    m.step(0x2661, 11); // HL = the row below (base+1 + 0x1f)
    mem.write8(regs.hl, 0x10);
    m.step(0x2663, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2664, 6);
    mem.write8(regs.hl, 0x10);
    m.step(0x2666, 10);
    regs.a = mem.read8(0x8004);
    m.step(0x2669, 13);
    regs.and(regs.a);
    m.step(0x266a, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x266b, 5);
    regs.xor(regs.a);
    m.step(0x266c, 4);
    mem.write8(0x8121, regs.a);
    m.step(0x266f, 13);
    mem.write8(0x8120, regs.a);
    m.step(0x2672, 13);
    m.ret();
  }
}
