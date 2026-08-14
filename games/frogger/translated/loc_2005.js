// SPDX-License-Identifier: GPL-3.0-only

// loc_2005  (ROM 0x2005-0x20BE) — NMI object-scroll driver. Copies (0x8273+2)->(0x811a) and
// (0x827c+2)->(0x8119); increments scroll counters (0x8110) by 1 and (0x8111) by 2, calling
// wrap-handlers loc_20fb (when (0x8110)>=0x50) and loc_219c (when (0x8111)<0xa0). Then advances the
// phase counter (0x826e) and, at 0x10/0x20/0x30, runs a lane-setup block (loc_2049/206f/2095) that
// loads two lane descriptors and tail-jumps the copy engine at 0x20cc / 0x20bf; otherwise returns.
export function loc_2005(m) {
  const { regs, mem } = m;

  regs.ix = 0x8273;
  m.step(0x2009, 14);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x200c, 19); // ld a,(ix+0x02)
  mem.write8(0x811a, regs.a);
  m.step(0x200f, 13);
  regs.a = mem.read8(0x8110);
  m.step(0x2012, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x2013, 4);
  mem.write8(0x8110, regs.a);
  m.step(0x2016, 13); // (0x8110) += 1
  regs.cp(0x50);
  m.step(0x2018, 7);
  if (regs.fNC) {
    m.push16(0x201b);
    m.step(0x20fb, 17); // call nc,0x20fb
    m.call(0x20fb);
  } else {
    m.step(0x201b, 10);
  }

  regs.ix = 0x827c;
  m.step(0x201f, 14);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x2022, 19); // ld a,(ix+0x02)
  mem.write8(0x8119, regs.a);
  m.step(0x2025, 13);
  regs.a = mem.read8(0x8111);
  m.step(0x2028, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x2029, 4);
  regs.a = regs.inc8(regs.a);
  m.step(0x202a, 4);
  mem.write8(0x8111, regs.a);
  m.step(0x202d, 13); // (0x8111) += 2
  regs.cp(0xa0);
  m.step(0x202f, 7);
  if (regs.fC) {
    m.push16(0x2032);
    m.step(0x219c, 17); // call c,0x219c
    m.call(0x219c);
  } else {
    m.step(0x2032, 10);
  }

  regs.a = mem.read8(0x826e);
  m.step(0x2035, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x2036, 4);
  mem.write8(0x826e, regs.a);
  m.step(0x2039, 13); // (0x826e) += 1 -- phase counter
  regs.cp(0x10);
  m.step(0x203b, 7);
  if (regs.fZ) {
    m.step(0x2049, 10);
    return block_2049();
  }
  m.step(0x203e, 10);
  regs.cp(0x20);
  m.step(0x2040, 7);
  if (regs.fZ) {
    m.step(0x206f, 10);
    return block_206f();
  }
  m.step(0x2043, 10);
  regs.cp(0x30);
  m.step(0x2045, 7);
  if (regs.fZ) {
    m.step(0x2095, 10);
    return block_2095();
  }
  m.step(0x2048, 10);
  m.ret(10);
  return;

  function block_2049() {
    regs.hl = 0x8273;
    m.step(0x204c, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x204d, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x204e, 6);
    regs.b = mem.read8(regs.hl);
    m.step(0x204f, 7);
    regs.hl = 0x811a;
    m.step(0x2052, 10);
    regs.c = mem.read8(regs.hl);
    m.step(0x2053, 7);
    regs.de = 0x1423;
    m.step(0x2056, 10);
    mem.write8(0x81b1, regs.a);
    m.step(0x2059, 13);
    m.push16(0x205c);
    m.step(0x20cc, 17); // call 0x20cc
    m.call(0x20cc);
    regs.hl = 0x827c;
    m.step(0x205f, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x2060, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2061, 6);
    regs.b = mem.read8(regs.hl);
    m.step(0x2062, 7);
    regs.hl = 0x8119;
    m.step(0x2065, 10);
    regs.c = mem.read8(regs.hl);
    m.step(0x2066, 7);
    regs.de = 0x145f;
    m.step(0x2069, 10);
    mem.write8(0x81b1, regs.a);
    m.step(0x206c, 13);
    m.step(0x20bf, 10); // jp 0x20bf
    return m.call(0x20bf);
  }

  function block_206f() {
    regs.hl = 0x8273;
    m.step(0x2072, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x2073, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2074, 6);
    regs.b = mem.read8(regs.hl);
    m.step(0x2075, 7);
    regs.hl = 0x811a;
    m.step(0x2078, 10);
    regs.c = mem.read8(regs.hl);
    m.step(0x2079, 7);
    regs.de = 0x142b;
    m.step(0x207c, 10);
    mem.write8(0x81b1, regs.a);
    m.step(0x207f, 13);
    m.push16(0x2082);
    m.step(0x20cc, 17); // call 0x20cc
    m.call(0x20cc);
    regs.hl = 0x827c;
    m.step(0x2085, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x2086, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2087, 6);
    regs.b = mem.read8(regs.hl);
    m.step(0x2088, 7);
    regs.hl = 0x8119;
    m.step(0x208b, 10);
    regs.c = mem.read8(regs.hl);
    m.step(0x208c, 7);
    regs.de = 0x1473;
    m.step(0x208f, 10);
    mem.write8(0x81b1, regs.a);
    m.step(0x2092, 13);
    m.step(0x20bf, 10); // jp 0x20bf
    return m.call(0x20bf);
  }

  function block_2095() {
    regs.hl = 0x8273;
    m.step(0x2098, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x2099, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x209a, 6);
    regs.b = mem.read8(regs.hl);
    m.step(0x209b, 7);
    regs.hl = 0x811a;
    m.step(0x209e, 10);
    regs.c = mem.read8(regs.hl);
    m.step(0x209f, 7);
    regs.de = 0x1433;
    m.step(0x20a2, 10);
    mem.write8(0x81b1, regs.a);
    m.step(0x20a5, 13);
    regs.xor(regs.a);
    m.step(0x20a6, 4);
    mem.write8(0x826e, regs.a);
    m.step(0x20a9, 13); // (0x826e) = 0 -- phase wraps
    m.push16(0x20ac);
    m.step(0x20cc, 17); // call 0x20cc
    m.call(0x20cc);
    regs.hl = 0x827c;
    m.step(0x20af, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x20b0, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x20b1, 6);
    regs.b = mem.read8(regs.hl);
    m.step(0x20b2, 7);
    regs.hl = 0x8119;
    m.step(0x20b5, 10);
    regs.c = mem.read8(regs.hl);
    m.step(0x20b6, 7);
    regs.de = 0x1487;
    m.step(0x20b9, 10);
    mem.write8(0x81b1, regs.a);
    m.step(0x20bc, 13);
    m.step(0x20bf, 10); // jp 0x20bf
    return m.call(0x20bf);
  }
}
