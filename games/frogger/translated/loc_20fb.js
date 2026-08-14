// SPDX-License-Identifier: GPL-3.0-only

// loc_20fb  (ROM 0x20FB-0x218F) — column scroll-wrap handler for the (0x8273) object. Builds a VRAM
// address from (ix+0x00)/(ix+0x01)/(ix+0x02) row/col fields plus base 0xA808, then dispatches on
// (0x8110): 0x50/0xD0 -> stamp table 0x2190, 0x80/0xB0 -> 0x2194 (+clear (0x8107)), 0xA0 -> 0x2198
// (+set (0x8107)); anything else falls straight to the tail. block_2178 is the folded 2-byte column
// stamp (pitch 0x1F, B rows); block_2188 (tail) writes (0x811a) = (ix+0x02)-1 and returns.
export function loc_20fb(m) {
  const { regs, mem } = m;

  regs.ix = 0x8273;
  m.step(0x20ff, 14);
  regs.xor(regs.a);
  m.step(0x2100, 4);
  regs.h = regs.a;
  m.step(0x2101, 4);
  regs.b = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x2104, 19); // ld b,(ix+0x01) -- column count

  for (;;) {
    // loc_2104: A += 0x20 per column
    regs.add(0x20);
    m.step(0x2106, 7);
    if (m.regs.djnz() !== 0) {
      m.step(0x2104, 13);
      continue;
    }
    m.step(0x2108, 8);
    break;
  }
  regs.c = regs.a;
  m.step(0x2109, 4);
  regs.l = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x210c, 19); // ld l,(ix+0x00)
  regs.addHl(regs.bc);
  m.step(0x210d, 11); // HL = (ix+0x00) + 0x20*(ix+0x01)
  regs.e = regs.l;
  m.step(0x210e, 4);
  regs.d = regs.h;
  m.step(0x210f, 4); // DE = HL
  regs.xor(regs.a);
  m.step(0x2110, 4);
  regs.l = regs.a;
  m.step(0x2111, 4);
  regs.h = regs.a;
  m.step(0x2112, 4); // HL = 0
  regs.b = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x2115, 19); // ld b,(ix+0x02) -- row count
  regs.b = regs.dec8(regs.b);
  m.step(0x2116, 4);

  for (;;) {
    // loc_2116: HL += DE, (ix+0x02)-1 times
    regs.addHl(regs.de);
    m.step(0x2117, 11);
    if (m.regs.djnz() !== 0) {
      m.step(0x2116, 13);
      continue;
    }
    m.step(0x2119, 8);
    break;
  }
  regs.de = 0xa808;
  m.step(0x211c, 10);
  regs.addHl(regs.de);
  m.step(0x211d, 11); // HL += 0xa808 -- VRAM stamp base
  regs.c = 0x02;
  m.step(0x211f, 7);
  regs.a = mem.read8(0x8110);
  m.step(0x2122, 13);

  regs.cp(0x50);
  m.step(0x2124, 7);
  if (regs.fZ) {
    m.step(0x213e, 10);
    return block_213e();
  }
  m.step(0x2127, 10);
  regs.cp(0x80);
  m.step(0x2129, 7);
  if (regs.fZ) {
    m.step(0x214c, 10);
    return block_214c();
  }
  m.step(0x212c, 10);
  regs.cp(0xa0);
  m.step(0x212e, 7);
  if (regs.fZ) {
    m.step(0x2165, 10);
    return block_2165();
  }
  m.step(0x2131, 10);
  regs.cp(0xb0);
  m.step(0x2133, 7);
  if (regs.fZ) {
    m.step(0x214c, 10);
    return block_214c();
  }
  m.step(0x2136, 10);
  regs.cp(0xd0);
  m.step(0x2138, 7);
  if (regs.fZ) {
    m.step(0x213e, 10);
    return block_213e();
  }
  m.step(0x213b, 10);
  m.step(0x2188, 10); // jp 0x2188
  return block_2188();

  function block_213e() {
    for (;;) {
      regs.b = 0x02;
      m.step(0x2140, 7);
      regs.de = 0x2190;
      m.step(0x2143, 10);
      m.push16(0x2146);
      m.step(0x2178, 17); // call 0x2178
      block_2178();
      regs.c = regs.dec8(regs.c);
      m.step(0x2147, 4);
      if (regs.fNZ) {
        m.step(0x213e, 12);
        continue;
      }
      m.step(0x2149, 7);
      break;
    }
    m.step(0x2188, 10); // jp 0x2188
    return block_2188();
  }

  function block_214c() {
    for (;;) {
      regs.b = 0x02;
      m.step(0x214e, 7);
      regs.de = 0x2194;
      m.step(0x2151, 10);
      m.push16(0x2154);
      m.step(0x2178, 17); // call 0x2178
      block_2178();
      regs.c = regs.dec8(regs.c);
      m.step(0x2155, 4);
      if (regs.fNZ) {
        m.step(0x214c, 12);
        continue;
      }
      m.step(0x2157, 7);
      break;
    }
    regs.a = mem.read8(0x8107);
    m.step(0x215a, 13);
    regs.and(regs.a);
    m.step(0x215b, 4);
    if (regs.fZ) {
      m.step(0x2188, 10);
      return block_2188();
    }
    m.step(0x215e, 10);
    regs.xor(regs.a);
    m.step(0x215f, 4);
    mem.write8(0x8107, regs.a);
    m.step(0x2162, 13); // (0x8107) = 0
    m.step(0x2188, 10); // jp 0x2188
    return block_2188();
  }

  function block_2165() {
    for (;;) {
      regs.b = 0x02;
      m.step(0x2167, 7);
      regs.de = 0x2198;
      m.step(0x216a, 10);
      m.push16(0x216d);
      m.step(0x2178, 17); // call 0x2178
      block_2178();
      regs.c = regs.dec8(regs.c);
      m.step(0x216d, 4);
      if (regs.fNZ) {
        m.step(0x2165, 12);
        continue;
      }
      m.step(0x2170, 7);
      break;
    }
    regs.a = 0x01;
    m.step(0x2172, 7);
    mem.write8(0x8107, regs.a);
    m.step(0x2175, 13); // (0x8107) = 1
    m.step(0x2188, 10); // jp 0x2188
    return block_2188();
  }

  function block_2178() {
    for (;;) {
      // loc_2178: stamp a 2-byte column pair, then step down one 0x1F row
      regs.a = mem.read8(regs.de);
      m.step(0x2179, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x217a, 7);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x217b, 6);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x217c, 6);
      regs.a = mem.read8(regs.de);
      m.step(0x217d, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x217e, 7);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x217f, 6);
      m.push16(regs.de);
      m.step(0x2180, 11);
      regs.de = 0x001f;
      m.step(0x2183, 10);
      regs.addHl(regs.de);
      m.step(0x2184, 11); // HL += 0x1f -- next row
      regs.de = m.pop16();
      m.step(0x2185, 10);
      if (m.regs.djnz() !== 0) {
        m.step(0x2178, 13);
        continue;
      }
      m.step(0x2187, 8);
      break;
    }
    m.ret(10);
  }

  function block_2188() {
    regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
    m.step(0x218b, 19); // ld a,(ix+0x02)
    regs.a = regs.dec8(regs.a);
    m.step(0x218c, 4);
    mem.write8(0x811a, regs.a);
    m.step(0x218f, 13); // (0x811a) = (ix+0x02) - 1
    m.ret(10);
  }
}
