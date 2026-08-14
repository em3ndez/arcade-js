// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";

// loc_11bf  (ROM 0x11BF-0x12CF) — frog-X lane-collision dispatcher (LO half). Guarded by (0x83CD)==0
// and (0x8004)==0; index = high nibble of (0x8047) (the frog X). HL = 0x11E9 + 2*index reads a 16-bit
// arm pointer from the table at 0x11E9 and `jp (hl)` enters that arm. 10 arms load an object list
// pointer + width into HL/C and jp the shared engine at 0x1270; the other 6 tail-jp the HI half at
// 0x12E4. The engine walks the object list and delegates to the frog-kill tail at 0x12D0 (this file's
// second export) or 0x12E4. Everything from 0x1209..0x12CF is interior to this routine.
export function loc_11bf(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83cd);
  m.step(0x11c2, 13);
  regs.or(regs.a);
  m.step(0x11c3, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  } // ret nz
  m.step(0x11c4, 5);
  regs.a = mem.read8(0x8004);
  m.step(0x11c7, 13);
  regs.and(regs.a);
  m.step(0x11c8, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  } // ret nz
  m.step(0x11c9, 5);
  regs.hl = 0x8047;
  m.step(0x11cc, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x11cd, 7); // A = (0x8047) frog X
  regs.c = regs.a;
  m.step(0x11ce, 4);
  regs.and(0x0f);
  m.step(0x11d0, 7); // low nibble
  regs.cp(0x09);
  m.step(0x11d2, 7);
  if (regs.fNC) {
    m.step(0x1209, 10);
    m.step(0x12e4, 10);
    return m.call(0x12e4);
  } // jp nc,0x1209 -> jp 0x12e4
  m.step(0x11d5, 10);
  regs.a = regs.c;
  m.step(0x11d6, 4);
  regs.and(0xf0);
  m.step(0x11d8, 7); // high nibble, in place
  regs.rrca();
  m.step(0x11d9, 4);
  regs.rrca();
  m.step(0x11da, 4);
  regs.rrca();
  m.step(0x11db, 4);
  regs.rrca();
  m.step(0x11dc, 4);
  regs.l = regs.a;
  m.step(0x11dd, 4); // L = arm index (0..15)
  regs.h = 0x00;
  m.step(0x11df, 7);
  regs.bc = 0x11e9;
  m.step(0x11e2, 10); // BC = pointer-table base
  regs.addHl(regs.hl);
  m.step(0x11e3, 11); // HL = 2*index
  regs.addHl(regs.bc);
  m.step(0x11e4, 11); // HL = 0x11e9 + 2*index
  regs.c = mem.read8(regs.hl);
  m.step(0x11e5, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x11e6, 6);
  regs.h = mem.read8(regs.hl);
  m.step(0x11e7, 7);
  regs.l = regs.c;
  m.step(0x11e8, 4); // HL = the arm pointer

  m.step(regs.hl, 4); // jp (hl)
  switch (regs.hl) {
    case 0x1209:
    case 0x120c:
    case 0x120f:
    case 0x123a:
    case 0x126a:
    case 0x126d:
      m.step(0x12e4, 10);
      return m.call(0x12e4); // jp 0x12e4 (HI half)
    case 0x1212:
      regs.hl = 0x8100; m.step(0x1215, 10);
      regs.c = 0x3c; m.step(0x1217, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x121a:
      regs.hl = 0x8109; m.step(0x121d, 10);
      regs.c = 0x1f; m.step(0x121f, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x1222:
      regs.hl = 0x8112; m.step(0x1225, 10);
      regs.c = 0x5c; m.step(0x1227, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x122a:
      regs.hl = 0x811b; m.step(0x122d, 10);
      regs.c = 0x2c; m.step(0x122f, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x1232:
      regs.hl = 0x8124; m.step(0x1235, 10);
      regs.c = 0x2f; m.step(0x1237, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x1242:
      regs.hl = 0x8136; m.step(0x1245, 10);
      regs.c = 0x22; m.step(0x1247, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x124a:
      regs.hl = 0x813f; m.step(0x124d, 10);
      regs.c = 0x12; m.step(0x124f, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x1252:
      regs.hl = 0x8148; m.step(0x1255, 10);
      regs.c = 0x12; m.step(0x1257, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x125a:
      regs.hl = 0x8151; m.step(0x125d, 10);
      regs.c = 0x12; m.step(0x125f, 7);
      m.step(0x1270, 10); return block_1270();
    case 0x1262:
      regs.hl = 0x815a; m.step(0x1265, 10);
      regs.c = 0x12; m.step(0x1267, 7);
      m.step(0x1270, 10); return block_1270();
    default:
      throw new NotImplemented(
        `loc_11bf jp(hl) at 0x11e8: target 0x${regs.hl.toString(16)} outside the frog-X arm ` +
          "table {0x1209..0x126d} -- corrupt pointer table at 0x11e9",
      );
  }

  function block_1270() {
    regs.a = mem.read8(0x8047);
    m.step(0x1273, 13);
    regs.cp(0x80);
    m.step(0x1275, 7);
    if (regs.fC) {
      m.step(0x1299, 10);
      return block_1299();
    } // jp c,0x1299 -- frog X in the lower band
    m.step(0x1278, 10);
    regs.a = mem.read8(0x8044);
    m.step(0x127b, 13);
    regs.add(0x03);
    m.step(0x127d, 7);
    return block_127d();
  }

  function block_127d() {
    regs.d = regs.a;
    m.step(0x127e, 4); // D = lower edge
    regs.add(regs.c);
    m.step(0x127f, 4); // A = lower + width
    regs.e = regs.a;
    m.step(0x1280, 4); // E = upper edge
    regs.b = mem.read8(regs.hl);
    m.step(0x1281, 7); // B = object count
    if (regs.fC) {
      m.step(0x12a1, 10);
      return block_12a1();
    } // jp c,0x12a1 -- edge wrapped past 0xff
    m.step(0x1284, 10);
    return block_1284();
  }

  function block_1284() {
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1285, 6);
    regs.a = mem.read8(regs.hl);
    m.step(0x1286, 7); // A = this object's X
    regs.cp(regs.d);
    m.step(0x1287, 4);
    if (regs.fC) {
      m.step(0x12b6, 10);
      return block_12b6();
    } // jp c,0x12b6 -- below D
    m.step(0x128a, 10);
    regs.cp(regs.e);
    m.step(0x128b, 4);
    if (regs.fNC) {
      m.step(0x12b6, 10);
      return block_12b6();
    } // jp nc,0x12b6 -- at/above E
    m.step(0x128e, 10);
    regs.a = mem.read8(0x8047);
    m.step(0x1291, 13);
    regs.cp(0x80);
    m.step(0x1293, 7);
    if (regs.fC) {
      m.step(0x12e4, 10);
      return m.call(0x12e4);
    } // jp c,0x12e4
    m.step(0x1296, 10);
    m.step(0x12d0, 10);
    return m.call(0x12d0); // jp 0x12d0 -- kill tail
  }

  function block_1299() {
    regs.a = mem.read8(0x8044);
    m.step(0x129c, 13);
    regs.add(0x0c);
    m.step(0x129e, 7);
    m.step(0x127d, 10);
    return block_127d(); // jp 0x127d
  }

  function block_12a1() {
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x12a2, 6);
    regs.a = mem.read8(regs.hl);
    m.step(0x12a3, 7);
    regs.cp(regs.d);
    m.step(0x12a4, 4);
    if (regs.fNC) {
      m.step(0x12ab, 10);
      return block_12ab();
    } // jp nc,0x12ab
    m.step(0x12a7, 10);
    regs.cp(regs.e);
    m.step(0x12a8, 4);
    if (regs.fNC) {
      m.step(0x12c3, 10);
      return block_12c3();
    } // jp nc,0x12c3
    m.step(0x12ab, 10);
    return block_12ab();
  }

  function block_12ab() {
    regs.a = mem.read8(0x8047);
    m.step(0x12ae, 13);
    regs.cp(0x80);
    m.step(0x12b0, 7);
    if (regs.fC) {
      m.step(0x12e4, 10);
      return m.call(0x12e4);
    } // jp c,0x12e4
    m.step(0x12b3, 10);
    m.step(0x12d0, 10);
    return m.call(0x12d0); // jp 0x12d0 -- kill tail
  }

  function block_12b6() {
    if (regs.djnz() !== 0) {
      m.step(0x1284, 13);
      return block_1284();
    } // djnz 0x1284
    m.step(0x12b8, 8);
    regs.a = mem.read8(0x8047);
    m.step(0x12bb, 13);
    regs.cp(0x80);
    m.step(0x12bd, 7);
    if (regs.fC) {
      m.step(0x12d0, 10);
      return m.call(0x12d0);
    } // jp c,0x12d0 -- kill tail
    m.step(0x12c0, 10);
    m.step(0x12e4, 10);
    return m.call(0x12e4); // jp 0x12e4
  }

  function block_12c3() {
    if (regs.djnz() !== 0) {
      m.step(0x12a1, 13);
      return block_12a1();
    } // djnz 0x12a1
    m.step(0x12c5, 8);
    regs.a = mem.read8(0x8047);
    m.step(0x12c8, 13);
    regs.cp(0x80);
    m.step(0x12ca, 7);
    if (regs.fC) {
      m.step(0x12d0, 10);
      return m.call(0x12d0);
    } // jp c,0x12d0 -- kill tail
    m.step(0x12cd, 10);
    m.step(0x12e4, 10);
    return m.call(0x12e4); // jp 0x12e4
  }
}

// loc_12d0  (ROM 0x12D0-0x12E3) — frog-kill tail. Mid-entry of the LO engine, also entered by the HI
// half (loc_12e4, jp c,0x12d0 @0x13de/0x13e9) and the diver-collision test (loc_28bb, call @0x28eb).
// Sets (0x8004)=1; if 0x30 <= (0x8047) < 0x80 also sets (0x829c)=1.
export function loc_12d0(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x12d2, 7);
  mem.write8(0x8004, regs.a);
  m.step(0x12d5, 13); // (0x8004) = 1
  regs.a = mem.read8(0x8047);
  m.step(0x12d8, 13);
  regs.cp(0x80);
  m.step(0x12da, 7);
  if (regs.fNC) {
    m.ret(11);
    return;
  } // ret nc
  m.step(0x12db, 5);
  regs.cp(0x30);
  m.step(0x12dd, 7);
  if (regs.fC) {
    m.ret(11);
    return;
  } // ret c
  m.step(0x12de, 5);
  regs.a = 0x01;
  m.step(0x12e0, 7);
  mem.write8(0x829c, regs.a);
  m.step(0x12e3, 13); // (0x829c) = 1
  m.ret(10);
}
