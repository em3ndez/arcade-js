// SPDX-License-Identifier: GPL-3.0-only

// loc_2532  (ROM 0x2532-0x25CD) — lane scroll-marker setup C: mirror (0x8120)->(0x8121), then dispatch on
// lane index (0x8120)==1..5 and, when that lane's object-present flag is clear, stamp a 2x2 tile marker
// (0xD0/0xD1 over 0xD2/0xD3) into the lane's video-RAM home cell.
export function loc_2532(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x2535, 13); // C = the collided-lane count in (0x83fd)
  regs.c = regs.a;
  m.step(0x2536, 4);
  regs.a = mem.read8(0x8120);
  m.step(0x2539, 13);
  mem.write8(0x8121, regs.a);
  m.step(0x253c, 13); // (0x8121) mirrors the prior stage's (0x8120)
  regs.cp(0x01);
  m.step(0x253e, 7); // A = the lane index 1..5
  if (regs.fZ) { m.step(0x2556, 10); return block_2556(); }
  m.step(0x2541, 10);
  regs.cp(0x02);
  m.step(0x2543, 7);
  if (regs.fZ) { m.step(0x256b, 10); return block_256b(); }
  m.step(0x2546, 10);
  regs.cp(0x03);
  m.step(0x2548, 7);
  if (regs.fZ) { m.step(0x2580, 10); return block_2580(); }
  m.step(0x254b, 10);
  regs.cp(0x04);
  m.step(0x254d, 7);
  if (regs.fZ) { m.step(0x2595, 10); return block_2595(); }
  m.step(0x2550, 10);
  regs.cp(0x05);
  m.step(0x2552, 7);
  if (regs.fZ) { m.step(0x25aa, 10); return block_25aa(); }
  m.step(0x2555, 10);
  m.ret();
  return;

  function block_2556() {
    regs.c = regs.dec8(regs.c);
    m.step(0x2557, 4);
    if (regs.fNZ) { m.step(0x2564, 12); return block_2564(); }
    m.step(0x2559, 7);
    regs.a = mem.read8(0x825e);
    m.step(0x255c, 13); // (0x825e) = lane-1 object-present flag
    regs.and(regs.a);
    m.step(0x255d, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x255e, 5);
    return block_255e();
  }

  function block_255e() {
    regs.hl = 0xab64;
    m.step(0x2561, 10);
    m.step(0x25bf, 10);
    return block_25bf();
  }

  function block_2564() {
    regs.a = mem.read8(0x8263);
    m.step(0x2567, 13);
    regs.and(regs.a);
    m.step(0x2568, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2569, 5);
    m.step(0x255e, 12);
    return block_255e();
  }

  function block_256b() {
    regs.c = regs.dec8(regs.c);
    m.step(0x256c, 4);
    if (regs.fNZ) { m.step(0x2579, 12); return block_2579(); }
    m.step(0x256e, 7);
    regs.a = mem.read8(0x825f);
    m.step(0x2571, 13);
    regs.and(regs.a);
    m.step(0x2572, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2573, 5);
    return block_2573();
  }

  function block_2573() {
    regs.hl = 0xaaa4;
    m.step(0x2576, 10);
    m.step(0x25bf, 10);
    return block_25bf();
  }

  function block_2579() {
    regs.a = mem.read8(0x8264);
    m.step(0x257c, 13);
    regs.and(regs.a);
    m.step(0x257d, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x257e, 5);
    m.step(0x2573, 12);
    return block_2573();
  }

  function block_2580() {
    regs.c = regs.dec8(regs.c);
    m.step(0x2581, 4);
    if (regs.fNZ) { m.step(0x258e, 12); return block_258e(); }
    m.step(0x2583, 7);
    regs.a = mem.read8(0x8260);
    m.step(0x2586, 13);
    regs.and(regs.a);
    m.step(0x2587, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2588, 5);
    return block_2588();
  }

  function block_2588() {
    regs.hl = 0xa9e4;
    m.step(0x258b, 10);
    m.step(0x25bf, 10);
    return block_25bf();
  }

  function block_258e() {
    regs.a = mem.read8(0x8265);
    m.step(0x2591, 13);
    regs.and(regs.a);
    m.step(0x2592, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2593, 5);
    m.step(0x2588, 12);
    return block_2588();
  }

  function block_2595() {
    regs.c = regs.dec8(regs.c);
    m.step(0x2596, 4);
    if (regs.fNZ) { m.step(0x25a3, 12); return block_25a3(); }
    m.step(0x2598, 7);
    regs.a = mem.read8(0x8261);
    m.step(0x259b, 13);
    regs.and(regs.a);
    m.step(0x259c, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x259d, 5);
    return block_259d();
  }

  function block_259d() {
    regs.hl = 0xa924;
    m.step(0x25a0, 10);
    m.step(0x25bf, 10);
    return block_25bf();
  }

  function block_25a3() {
    regs.a = mem.read8(0x8266);
    m.step(0x25a6, 13);
    regs.and(regs.a);
    m.step(0x25a7, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x25a8, 5);
    m.step(0x259d, 12);
    return block_259d();
  }

  function block_25aa() {
    regs.c = regs.dec8(regs.c);
    m.step(0x25ab, 4);
    if (regs.fNZ) { m.step(0x25b8, 12); return block_25b8(); }
    m.step(0x25ad, 7);
    regs.a = mem.read8(0x8262);
    m.step(0x25b0, 13);
    regs.and(regs.a);
    m.step(0x25b1, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x25b2, 5);
    return block_25b2();
  }

  function block_25b2() {
    regs.hl = 0xa864;
    m.step(0x25b5, 10);
    m.step(0x25bf, 10);
    return block_25bf();
  }

  function block_25b8() {
    regs.a = mem.read8(0x8267);
    m.step(0x25bb, 13);
    regs.and(regs.a);
    m.step(0x25bc, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x25bd, 5);
    m.step(0x25b2, 12);
    return block_25b2();
  }

  function block_25bf() {
    mem.write8(regs.hl, 0xd0);
    m.step(0x25c1, 10); // top-left marker tile
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x25c2, 6);
    mem.write8(regs.hl, 0xd1);
    m.step(0x25c4, 10);
    regs.bc = 0x001f;
    m.step(0x25c7, 10);
    regs.addHl(regs.bc);
    m.step(0x25c8, 11); // HL += 0x1F -> the row below, one column back
    mem.write8(regs.hl, 0xd2);
    m.step(0x25ca, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x25cb, 6);
    mem.write8(regs.hl, 0xd3);
    m.step(0x25cd, 10);
    m.ret();
  }
}
