// SPDX-License-Identifier: GPL-3.0-only

// loc_14dd..loc_1587  (ROM 0x14DD-0x1597) — the 11 object-dispatcher arms of loc_14b7. Each loads a
// lane's HL/DE/IX/IY pointers (frame byte / shift-vector / sprite base / phase) then jp's to a mover
// (0x1598 right, 0x163e left); loc_1532 is the shortcut arm that only jp's to the advance tail 0x15de.
export function loc_14dd(m) {
  const { regs } = m;
  regs.hl = 0x819b;
  m.step(0x14e0, 10);
  regs.de = 0x8100;
  m.step(0x14e3, 10);
  regs.ix = 0x800c;
  m.step(0x14e7, 14);
  regs.iy = 0x81a6;
  m.step(0x14eb, 14);
  m.step(0x1598, 10);
  return m.call(0x1598);
}

export function loc_14ee(m) {
  const { regs } = m;
  regs.hl = 0x819c;
  m.step(0x14f1, 10);
  regs.de = 0x8109;
  m.step(0x14f4, 10);
  regs.ix = 0x8010;
  m.step(0x14f8, 14);
  regs.iy = 0x81a7;
  m.step(0x14fc, 14);
  m.step(0x163e, 10);
  return m.call(0x163e);
}

export function loc_14ff(m) {
  const { regs } = m;
  regs.hl = 0x819d;
  m.step(0x1502, 10);
  regs.de = 0x8112;
  m.step(0x1505, 10);
  regs.ix = 0x8014;
  m.step(0x1509, 14);
  regs.iy = 0x81a8;
  m.step(0x150d, 14);
  m.step(0x1598, 10);
  return m.call(0x1598);
}

export function loc_1510(m) {
  const { regs } = m;
  regs.hl = 0x819e;
  m.step(0x1513, 10);
  regs.de = 0x811b;
  m.step(0x1516, 10);
  regs.ix = 0x8018;
  m.step(0x151a, 14);
  regs.iy = 0x81a9;
  m.step(0x151e, 14);
  m.step(0x1598, 10);
  return m.call(0x1598);
}

export function loc_1521(m) {
  const { regs } = m;
  regs.hl = 0x819f;
  m.step(0x1524, 10);
  regs.de = 0x8124;
  m.step(0x1527, 10);
  regs.ix = 0x801c;
  m.step(0x152b, 14);
  regs.iy = 0x81aa;
  m.step(0x152f, 14);
  m.step(0x163e, 10);
  return m.call(0x163e);
}

export function loc_1532(m) {
  m.step(0x15de, 10);
  return m.call(0x15de);
}

export function loc_1543(m) {
  const { regs } = m;
  regs.hl = 0x81a1;
  m.step(0x1546, 10);
  regs.de = 0x8136;
  m.step(0x1549, 10);
  regs.ix = 0x8024;
  m.step(0x154d, 14);
  regs.iy = 0x81ac;
  m.step(0x1551, 14);
  m.step(0x163e, 10);
  return m.call(0x163e);
}

export function loc_1554(m) {
  const { regs } = m;
  regs.hl = 0x81a2;
  m.step(0x1557, 10);
  regs.de = 0x813f;
  m.step(0x155a, 10);
  regs.ix = 0x8028;
  m.step(0x155e, 14);
  regs.iy = 0x81ad;
  m.step(0x1562, 14);
  m.step(0x1598, 10);
  return m.call(0x1598);
}

export function loc_1565(m) {
  const { regs } = m;
  regs.hl = 0x81a3;
  m.step(0x1568, 10);
  regs.de = 0x8148;
  m.step(0x156b, 10);
  regs.ix = 0x802c;
  m.step(0x156f, 14);
  regs.iy = 0x81ae;
  m.step(0x1573, 14);
  m.step(0x163e, 10);
  return m.call(0x163e);
}

export function loc_1576(m) {
  const { regs } = m;
  regs.hl = 0x81a4;
  m.step(0x1579, 10);
  regs.de = 0x8151;
  m.step(0x157c, 10);
  regs.ix = 0x8030;
  m.step(0x1580, 14);
  regs.iy = 0x81af;
  m.step(0x1584, 14);
  m.step(0x1598, 10);
  return m.call(0x1598);
}

export function loc_1587(m) {
  const { regs } = m;
  regs.hl = 0x81a5;
  m.step(0x158a, 10);
  regs.de = 0x815a;
  m.step(0x158d, 10);
  regs.ix = 0x8034;
  m.step(0x1591, 14);
  regs.iy = 0x81b0;
  m.step(0x1595, 14);
  m.step(0x163e, 10);
  return m.call(0x163e);
}
