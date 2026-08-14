// SPDX-License-Identifier: GPL-3.0-only

// loc_2496  (ROM 0x2496-0x2531) — lane scroll-marker setup B: mirror the scroll timer (0x8123)->(0x8120),
// then dispatch on lane index (0x8123)==1..5 and, when that lane's object-present flag is clear, stamp a
// 2x2 tile marker (0x10/0x10 over 0xD0/0xD1) into the lane's video-RAM home cell.
export function loc_2496(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x2499, 13); // C = the collided-lane count in (0x83fd)
  regs.c = regs.a;
  m.step(0x249a, 4);
  regs.a = mem.read8(0x8123);
  m.step(0x249d, 13);
  mem.write8(0x8120, regs.a);
  m.step(0x24a0, 13); // (0x8120) mirrors the scroll timer (0x8123)
  regs.cp(0x01);
  m.step(0x24a2, 7); // A = the lane index 1..5
  if (regs.fZ) { m.step(0x24ba, 10); return block_24ba(); }
  m.step(0x24a5, 10);
  regs.cp(0x02);
  m.step(0x24a7, 7);
  if (regs.fZ) { m.step(0x24cf, 10); return block_24cf(); }
  m.step(0x24aa, 10);
  regs.cp(0x03);
  m.step(0x24ac, 7);
  if (regs.fZ) { m.step(0x24e4, 10); return block_24e4(); }
  m.step(0x24af, 10);
  regs.cp(0x04);
  m.step(0x24b1, 7);
  if (regs.fZ) { m.step(0x24f9, 10); return block_24f9(); }
  m.step(0x24b4, 10);
  regs.cp(0x05);
  m.step(0x24b6, 7);
  if (regs.fZ) { m.step(0x250e, 10); return block_250e(); }
  m.step(0x24b9, 10);
  m.ret();
  return;

  function block_24ba() {
    regs.c = regs.dec8(regs.c);
    m.step(0x24bb, 4);
    if (regs.fNZ) { m.step(0x24c8, 12); return block_24c8(); }
    m.step(0x24bd, 7);
    regs.a = mem.read8(0x825e);
    m.step(0x24c0, 13); // (0x825e) = lane-1 object-present flag
    regs.and(regs.a);
    m.step(0x24c1, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x24c2, 5);
    return block_24c2();
  }

  function block_24c2() {
    regs.hl = 0xab64;
    m.step(0x24c5, 10);
    m.step(0x2523, 10);
    return block_2523();
  }

  function block_24c8() {
    regs.a = mem.read8(0x8263);
    m.step(0x24cb, 13);
    regs.and(regs.a);
    m.step(0x24cc, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x24cd, 5);
    m.step(0x24c2, 12);
    return block_24c2();
  }

  function block_24cf() {
    regs.c = regs.dec8(regs.c);
    m.step(0x24d0, 4);
    if (regs.fNZ) { m.step(0x24dd, 12); return block_24dd(); }
    m.step(0x24d2, 7);
    regs.a = mem.read8(0x825f);
    m.step(0x24d5, 13);
    regs.and(regs.a);
    m.step(0x24d6, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x24d7, 5);
    return block_24d7();
  }

  function block_24d7() {
    regs.hl = 0xaaa4;
    m.step(0x24da, 10);
    m.step(0x2523, 10);
    return block_2523();
  }

  function block_24dd() {
    regs.a = mem.read8(0x8264);
    m.step(0x24e0, 13);
    regs.and(regs.a);
    m.step(0x24e1, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x24e2, 5);
    m.step(0x24d7, 12);
    return block_24d7();
  }

  function block_24e4() {
    regs.c = regs.dec8(regs.c);
    m.step(0x24e5, 4);
    if (regs.fNZ) { m.step(0x24f2, 12); return block_24f2(); }
    m.step(0x24e7, 7);
    regs.a = mem.read8(0x8260);
    m.step(0x24ea, 13);
    regs.and(regs.a);
    m.step(0x24eb, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x24ec, 5);
    return block_24ec();
  }

  function block_24ec() {
    regs.hl = 0xa9e4;
    m.step(0x24ef, 10);
    m.step(0x2523, 10);
    return block_2523();
  }

  function block_24f2() {
    regs.a = mem.read8(0x8265);
    m.step(0x24f5, 13);
    regs.and(regs.a);
    m.step(0x24f6, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x24f7, 5);
    m.step(0x24ec, 12);
    return block_24ec();
  }

  function block_24f9() {
    regs.c = regs.dec8(regs.c);
    m.step(0x24fa, 4);
    if (regs.fNZ) { m.step(0x2507, 12); return block_2507(); }
    m.step(0x24fc, 7);
    regs.a = mem.read8(0x8261);
    m.step(0x24ff, 13);
    regs.and(regs.a);
    m.step(0x2500, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2501, 5);
    return block_2501();
  }

  function block_2501() {
    regs.hl = 0xa924;
    m.step(0x2504, 10);
    m.step(0x2523, 10);
    return block_2523();
  }

  function block_2507() {
    regs.a = mem.read8(0x8266);
    m.step(0x250a, 13);
    regs.and(regs.a);
    m.step(0x250b, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x250c, 5);
    m.step(0x2501, 12);
    return block_2501();
  }

  function block_250e() {
    regs.c = regs.dec8(regs.c);
    m.step(0x250f, 4);
    if (regs.fNZ) { m.step(0x251c, 12); return block_251c(); }
    m.step(0x2511, 7);
    regs.a = mem.read8(0x8262);
    m.step(0x2514, 13);
    regs.and(regs.a);
    m.step(0x2515, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2516, 5);
    return block_2516();
  }

  function block_2516() {
    regs.hl = 0xa864;
    m.step(0x2519, 10);
    m.step(0x2523, 10);
    return block_2523();
  }

  function block_251c() {
    regs.a = mem.read8(0x8267);
    m.step(0x251f, 13);
    regs.and(regs.a);
    m.step(0x2520, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2521, 5);
    m.step(0x2516, 12);
    return block_2516();
  }

  function block_2523() {
    mem.write8(regs.hl, 0x10);
    m.step(0x2525, 10); // top-left marker tile
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2526, 6);
    mem.write8(regs.hl, 0x10);
    m.step(0x2528, 10);
    regs.bc = 0x001f;
    m.step(0x252b, 10);
    regs.addHl(regs.bc);
    m.step(0x252c, 11); // HL += 0x1F -> the row below, one column back
    mem.write8(regs.hl, 0xd0);
    m.step(0x252e, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x252f, 6);
    mem.write8(regs.hl, 0xd1);
    m.step(0x2531, 10);
    m.ret();
  }
}
