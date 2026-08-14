// SPDX-License-Identifier: GPL-3.0-only

// loc_23fa  (ROM 0x23FA-0x2495) — lane scroll-marker setup A: mirror the scroll timer (0x8123)->(0x8121),
// then dispatch on lane index (0x8123)==1..5 and, when that lane's object-present flag is clear, stamp a
// 2x2 tile marker (0x2C/0x2D over 0x2E/0x2F) into the lane's video-RAM home cell.
export function loc_23fa(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x23fd, 13); // C = the collided-lane count in (0x83fd)
  regs.c = regs.a;
  m.step(0x23fe, 4);
  regs.a = mem.read8(0x8123);
  m.step(0x2401, 13);
  mem.write8(0x8121, regs.a);
  m.step(0x2404, 13); // (0x8121) mirrors the scroll timer (0x8123)
  regs.cp(0x01);
  m.step(0x2406, 7); // A = the lane index 1..5
  if (regs.fZ) { m.step(0x241e, 10); return block_241e(); }
  m.step(0x2409, 10);
  regs.cp(0x02);
  m.step(0x240b, 7);
  if (regs.fZ) { m.step(0x2433, 10); return block_2433(); }
  m.step(0x240e, 10);
  regs.cp(0x03);
  m.step(0x2410, 7);
  if (regs.fZ) { m.step(0x2448, 10); return block_2448(); }
  m.step(0x2413, 10);
  regs.cp(0x04);
  m.step(0x2415, 7);
  if (regs.fZ) { m.step(0x245d, 10); return block_245d(); }
  m.step(0x2418, 10);
  regs.cp(0x05);
  m.step(0x241a, 7);
  if (regs.fZ) { m.step(0x2472, 10); return block_2472(); }
  m.step(0x241d, 10);
  m.ret();
  return;

  function block_241e() {
    regs.c = regs.dec8(regs.c);
    m.step(0x241f, 4);
    if (regs.fNZ) { m.step(0x242c, 12); return block_242c(); }
    m.step(0x2421, 7);
    regs.a = mem.read8(0x825e);
    m.step(0x2424, 13); // (0x825e) = lane-1 object-present flag
    regs.and(regs.a);
    m.step(0x2425, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2426, 5);
    return block_2426();
  }

  function block_2426() {
    regs.hl = 0xab64;
    m.step(0x2429, 10);
    m.step(0x2487, 10);
    return block_2487();
  }

  function block_242c() {
    regs.a = mem.read8(0x8263);
    m.step(0x242f, 13);
    regs.and(regs.a);
    m.step(0x2430, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2431, 5);
    m.step(0x2426, 12);
    return block_2426();
  }

  function block_2433() {
    regs.c = regs.dec8(regs.c);
    m.step(0x2434, 4);
    if (regs.fNZ) { m.step(0x2441, 12); return block_2441(); }
    m.step(0x2436, 7);
    regs.a = mem.read8(0x825f);
    m.step(0x2439, 13);
    regs.and(regs.a);
    m.step(0x243a, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x243b, 5);
    return block_243b();
  }

  function block_243b() {
    regs.hl = 0xaaa4;
    m.step(0x243e, 10);
    m.step(0x2487, 10);
    return block_2487();
  }

  function block_2441() {
    regs.a = mem.read8(0x8264);
    m.step(0x2444, 13);
    regs.and(regs.a);
    m.step(0x2445, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2446, 5);
    m.step(0x243b, 12);
    return block_243b();
  }

  function block_2448() {
    regs.c = regs.dec8(regs.c);
    m.step(0x2449, 4);
    if (regs.fNZ) { m.step(0x2456, 12); return block_2456(); }
    m.step(0x244b, 7);
    regs.a = mem.read8(0x8260);
    m.step(0x244e, 13);
    regs.and(regs.a);
    m.step(0x244f, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2450, 5);
    return block_2450();
  }

  function block_2450() {
    regs.hl = 0xa9e4;
    m.step(0x2453, 10);
    m.step(0x2487, 10);
    return block_2487();
  }

  function block_2456() {
    regs.a = mem.read8(0x8265);
    m.step(0x2459, 13);
    regs.and(regs.a);
    m.step(0x245a, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x245b, 5);
    m.step(0x2450, 12);
    return block_2450();
  }

  function block_245d() {
    regs.c = regs.dec8(regs.c);
    m.step(0x245e, 4);
    if (regs.fNZ) { m.step(0x246b, 12); return block_246b(); }
    m.step(0x2460, 7);
    regs.a = mem.read8(0x8261);
    m.step(0x2463, 13);
    regs.and(regs.a);
    m.step(0x2464, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2465, 5);
    return block_2465();
  }

  function block_2465() {
    regs.hl = 0xa924;
    m.step(0x2468, 10);
    m.step(0x2487, 10);
    return block_2487();
  }

  function block_246b() {
    regs.a = mem.read8(0x8266);
    m.step(0x246e, 13);
    regs.and(regs.a);
    m.step(0x246f, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2470, 5);
    m.step(0x2465, 12);
    return block_2465();
  }

  function block_2472() {
    regs.c = regs.dec8(regs.c);
    m.step(0x2473, 4);
    if (regs.fNZ) { m.step(0x2480, 12); return block_2480(); }
    m.step(0x2475, 7);
    regs.a = mem.read8(0x8262);
    m.step(0x2478, 13);
    regs.and(regs.a);
    m.step(0x2479, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x247a, 5);
    return block_247a();
  }

  function block_247a() {
    regs.hl = 0xa864;
    m.step(0x247d, 10);
    m.step(0x2487, 10);
    return block_2487();
  }

  function block_2480() {
    regs.a = mem.read8(0x8267);
    m.step(0x2483, 13);
    regs.and(regs.a);
    m.step(0x2484, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x2485, 5);
    m.step(0x247a, 12);
    return block_247a();
  }

  function block_2487() {
    mem.write8(regs.hl, 0x2c);
    m.step(0x2489, 10); // top-left marker tile
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x248a, 6);
    mem.write8(regs.hl, 0x2d);
    m.step(0x248c, 10);
    regs.bc = 0x001f;
    m.step(0x248f, 10);
    regs.addHl(regs.bc);
    m.step(0x2490, 11); // HL += 0x1F -> the row below, one column back
    mem.write8(regs.hl, 0x2e);
    m.step(0x2492, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2493, 6);
    mem.write8(regs.hl, 0x2f);
    m.step(0x2495, 10);
    m.ret();
  }
}
