// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";

// loc_12e4  (ROM 0x12E4-0x13EC) — frog-X move dispatcher HI (sibling of the LO dispatcher). Guarded by
// (0x8004): if nonzero, ret. Index = high nibble of ((0x8047)+0x0F); low nibble <5 short-circuits to
// arm 0. HL = 0x130B + 2*index reads a pointer from the table at 0x130B and jp(hl) enters one of 16
// arms (0x132B-0x138C). Arms set HL/C then fall into the lane-scan engine at 0x138F, which on a hit
// with (0x8047)>=0x80 sets (0x8004)=1, else tail-jumps to the frog-kill entry 0x12D0.
export function loc_12e4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8004);
  m.step(0x12e7, 13); // ld a,(0x8004)
  regs.and(regs.a);
  m.step(0x12e8, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz -- move already resolved this frame
    return;
  }
  m.step(0x12e9, 5);
  regs.hl = 0x8047;
  m.step(0x12ec, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x12ed, 7); // A = (0x8047), the frog X
  regs.add(0x0f);
  m.step(0x12ef, 7); // add a,0x0f
  regs.c = regs.a;
  m.step(0x12f0, 4); // C = X+0x0f
  regs.and(0x0f);
  m.step(0x12f2, 7); // low nibble
  regs.cp(0x05);
  m.step(0x12f4, 7); // cp 0x05
  if (regs.fC) {
    m.step(0x132b, 10); // jp c,0x132b -- low nibble <5 -> arm 0
    return block_132b();
  }
  m.step(0x12f7, 10);
  regs.a = regs.c;
  m.step(0x12f8, 4); // A = X+0x0f again
  regs.and(0xf0);
  m.step(0x12fa, 7); // high nibble
  regs.rrca();
  m.step(0x12fb, 4);
  regs.rrca();
  m.step(0x12fc, 4);
  regs.rrca();
  m.step(0x12fd, 4);
  regs.rrca();
  m.step(0x12fe, 4); // A = index (0..15)
  regs.l = regs.a;
  m.step(0x12ff, 4);
  regs.h = 0x00;
  m.step(0x1301, 7);
  regs.bc = 0x130b;
  m.step(0x1304, 10); // BC = pointer-table base
  regs.addHl(regs.hl);
  m.step(0x1305, 11); // HL = 2*index
  regs.addHl(regs.bc);
  m.step(0x1306, 11); // HL = 0x130b + 2*index
  regs.c = mem.read8(regs.hl);
  m.step(0x1307, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1308, 6);
  regs.h = mem.read8(regs.hl);
  m.step(0x1309, 7);
  regs.l = regs.c;
  m.step(0x130a, 4); // HL = the arm pointer

  m.step(regs.hl, 4); // jp (hl)
  switch (regs.hl) {
    case 0x132b: return block_132b();
    case 0x132e: return block_132e();
    case 0x1331: return block_1331();
    case 0x1334: return block_1334();
    case 0x133c: return block_133c();
    case 0x1344: return block_1344();
    case 0x134c: return block_134c();
    case 0x1354: return block_1354();
    case 0x135c: return block_135c();
    case 0x1364: return block_1364();
    case 0x136c: return block_136c();
    case 0x1374: return block_1374();
    case 0x137c: return block_137c();
    case 0x1384: return block_1384();
    case 0x138c: return block_138c();
    default:
      throw new NotImplemented(
        `loc_12e4 jp(hl) at 0x130a: target 0x${regs.hl.toString(16)} outside the arm table ` +
          "{0x132b..0x138c} -- ((0x8047)+0x0f) high nibble out of range",
      );
  }

  // Arms 0/1/2/8/14/15: no lane, jp straight to the ret at 0x13e1.
  function block_132b() { m.step(0x13e1, 10); return block_13e1(); }
  function block_132e() { m.step(0x13e1, 10); return block_13e1(); }
  function block_1331() { m.step(0x13e1, 10); return block_13e1(); }
  function block_135c() { m.step(0x13e1, 10); return block_13e1(); }
  function block_138c() { m.step(0x13e1, 10); return block_13e1(); }

  // Arms 3-7,9-13: seed HL=lane base, C=lane width, jp into the engine at 0x138f.
  function block_1334() { regs.hl = 0x8100; m.step(0x1337, 10); regs.c = 0x3c; m.step(0x1339, 7); m.step(0x138f, 10); return block_138f(); }
  function block_133c() { regs.hl = 0x8109; m.step(0x133f, 10); regs.c = 0x1f; m.step(0x1341, 7); m.step(0x138f, 10); return block_138f(); }
  function block_1344() { regs.hl = 0x8112; m.step(0x1347, 10); regs.c = 0x5c; m.step(0x1349, 7); m.step(0x138f, 10); return block_138f(); }
  function block_134c() { regs.hl = 0x811b; m.step(0x134f, 10); regs.c = 0x2c; m.step(0x1351, 7); m.step(0x138f, 10); return block_138f(); }
  function block_1354() { regs.hl = 0x8124; m.step(0x1357, 10); regs.c = 0x2f; m.step(0x1359, 7); m.step(0x138f, 10); return block_138f(); }
  function block_1364() { regs.hl = 0x8136; m.step(0x1367, 10); regs.c = 0x22; m.step(0x1369, 7); m.step(0x138f, 10); return block_138f(); }
  function block_136c() { regs.hl = 0x813f; m.step(0x136f, 10); regs.c = 0x12; m.step(0x1371, 7); m.step(0x138f, 10); return block_138f(); }
  function block_1374() { regs.hl = 0x8148; m.step(0x1377, 10); regs.c = 0x12; m.step(0x1379, 7); m.step(0x138f, 10); return block_138f(); }
  function block_137c() { regs.hl = 0x8151; m.step(0x137f, 10); regs.c = 0x12; m.step(0x1381, 7); m.step(0x138f, 10); return block_138f(); }
  function block_1384() { regs.hl = 0x815a; m.step(0x1387, 10); regs.c = 0x12; m.step(0x1389, 7); m.step(0x138f, 10); return block_138f(); }

  function block_138f() {
    regs.a = mem.read8(0x802f);
    m.step(0x1392, 13);
    regs.cp(0x80);
    m.step(0x1394, 7);
    if (regs.fC) {
      m.step(0x13b9, 10); // jp c,0x13b9
      return block_13b9();
    }
    m.step(0x1397, 10);
    regs.a = mem.read8(0x8044);
    m.step(0x139a, 13);
    regs.add(0x03);
    m.step(0x139c, 7); // add a,0x03
    return block_139c();
  }

  function block_13b9() {
    regs.a = mem.read8(0x8044);
    m.step(0x13bc, 13);
    regs.add(0x0c);
    m.step(0x13be, 7); // add a,0x0c
    m.step(0x139c, 10);
    return block_139c();
  }

  function block_139c() {
    regs.d = regs.a;
    m.step(0x139d, 4); // D = low bound
    regs.add(regs.c);
    m.step(0x139e, 4); // A = D + width
    regs.e = regs.a;
    m.step(0x139f, 4); // E = high bound
    regs.b = mem.read8(regs.hl);
    m.step(0x13a0, 7); // B = object count
    if (regs.fC) {
      m.step(0x13c1, 10); // jp c,0x13c1 -- bound wrapped
      return block_13c1();
    }
    m.step(0x13a3, 10);
    return block_13a3();
  }

  function block_13a3() {
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x13a4, 6);
    regs.a = mem.read8(regs.hl);
    m.step(0x13a5, 7); // A = object position
    regs.cp(regs.d);
    m.step(0x13a6, 4);
    if (regs.fC) {
      m.step(0x13d7, 10); // jp c,0x13d7 -- below low bound
      return block_13d7();
    }
    m.step(0x13a9, 10);
    regs.cp(regs.e);
    m.step(0x13aa, 4);
    if (regs.fNC) {
      m.step(0x13d7, 10); // jp nc,0x13d7 -- at/above high bound
      return block_13d7();
    }
    m.step(0x13ad, 10);
    regs.a = mem.read8(0x8047);
    m.step(0x13b0, 13);
    regs.cp(0x80);
    m.step(0x13b2, 7);
    if (regs.fC) {
      m.ret(11); // ret c -- frog not yet across
      return;
    }
    m.step(0x13b3, 5);
    regs.a = 0x01;
    m.step(0x13b5, 7);
    mem.write8(0x8004, regs.a);
    m.step(0x13b8, 13); // (0x8004) = 1 -- move blocked
    m.ret();
  }

  function block_13c1() {
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x13c2, 6);
    regs.a = mem.read8(regs.hl);
    m.step(0x13c3, 7);
    regs.cp(regs.d);
    m.step(0x13c4, 4);
    if (regs.fNC) {
      m.step(0x13cb, 10); // jp nc,0x13cb
      return block_13cb();
    }
    m.step(0x13c7, 10);
    regs.cp(regs.e);
    m.step(0x13c8, 4);
    if (regs.fNC) {
      m.step(0x13e2, 10); // jp nc,0x13e2
      return block_13e2();
    }
    m.step(0x13cb, 10);
    return block_13cb();
  }

  function block_13cb() {
    regs.a = mem.read8(0x8047);
    m.step(0x13ce, 13);
    regs.cp(0x80);
    m.step(0x13d0, 7);
    if (regs.fC) {
      m.ret(11); // ret c
      return;
    }
    m.step(0x13d1, 5);
    regs.a = 0x01;
    m.step(0x13d3, 7);
    mem.write8(0x8004, regs.a);
    m.step(0x13d6, 13); // (0x8004) = 1
    m.ret();
  }

  function block_13d7() {
    if (m.regs.djnz() !== 0) {
      m.step(0x13a3, 13); // djnz 0x13a3
      return block_13a3();
    }
    m.step(0x13d9, 8);
    regs.a = mem.read8(0x8047);
    m.step(0x13dc, 13);
    regs.cp(0x80);
    m.step(0x13de, 7);
    if (regs.fC) {
      m.step(0x12d0, 10); // jp c,0x12d0 -- tail-jump to frog-kill
      return m.call(0x12d0);
    }
    m.step(0x13e1, 10);
    return block_13e1();
  }

  function block_13e1() {
    m.ret();
  }

  function block_13e2() {
    if (m.regs.djnz() !== 0) {
      m.step(0x13c1, 13); // djnz 0x13c1
      return block_13c1();
    }
    m.step(0x13e4, 8);
    regs.a = mem.read8(0x8047);
    m.step(0x13e7, 13);
    regs.cp(0x80);
    m.step(0x13e9, 7);
    if (regs.fC) {
      m.step(0x12d0, 10); // jp c,0x12d0 -- tail-jump to frog-kill
      return m.call(0x12d0);
    }
    m.step(0x13ec, 10);
    m.ret();
  }
}
