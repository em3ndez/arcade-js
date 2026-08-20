// SPDX-License-Identifier: GPL-3.0-only

// loc_191c  (ROM 0x191c-0x196d) -- gated target-column setup. Returns early unless 0x8901 and
// 0x8a82 are both zero; scans the 6-entry 0x8ae2 table (stride 0x18) and bails (ret z) if any
// entry holds 0x03. Otherwise bumps counter 0x880a, then per 0x8907 bit0 builds a column value
// (offsets from 0x8820, and 0x8903 when bit0 clear) clamped to 0x1f, stores it to 0x8900, and
// clears 0x8a87/0x8905/0x8906. No calls (leaf).
export function loc_191c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8901);        m.step(0x191f, 13);
  regs.and(regs.a);                  m.step(0x1920, 4);
  if (regs.fNZ) { return m.ret(11); } // ret nz -- 0x8901 nonzero
  m.step(0x1921, 5);
  regs.a = mem.read8(0x8a82);        m.step(0x1924, 13);
  regs.and(regs.a);                  m.step(0x1925, 4);
  if (regs.fNZ) { return m.ret(11); } // ret nz -- 0x8a82 nonzero
  m.step(0x1926, 5);
  regs.hl = 0x8ae2;                  m.step(0x1929, 10);
  regs.de = 0x0018;                  m.step(0x192c, 10);
  regs.b = 0x06;                     m.step(0x192e, 7);
  regs.a = 0x03;                     m.step(0x1930, 7);

  // loc_1930: scan the 6-entry table for a slot already holding 0x03
  for (;;) {
    regs.cp(mem.read8(regs.hl));       m.step(0x1931, 7);
    if (regs.fZ) { return m.ret(11); } // ret z -- slot == 0x03, abort
    m.step(0x1932, 5);
    regs.addHl(regs.de);               m.step(0x1933, 11);
    if (regs.djnz()) { m.step(0x1930, 13); } else { m.step(0x1935, 8); break; }
  }

  regs.hl = 0x880a;                  m.step(0x1938, 10);
  regs.incMem8(mem, regs.hl);        m.step(0x1939, 11); // inc (hl)
  regs.a = mem.read8(0x8907);        m.step(0x193c, 13);
  regs.bit(0, regs.a);               m.step(0x193e, 8);

  if (regs.fNZ) {
    m.step(0x1955, 12);              // jr nz,0x1955 -- 0x8907 bit0 set
    regs.b = regs.a;                 m.step(0x1956, 4);
    regs.a = mem.read8(0x8820);      m.step(0x1959, 13);
    regs.add(regs.b);                m.step(0x195a, 4);
    regs.cp(0x20);                   m.step(0x195c, 7);
    if (regs.fC) {
      m.step(0x1960, 12);            // jr c,0x1960
    } else {
      m.step(0x195e, 7);
      regs.a = 0x1f;                 m.step(0x1960, 7); // clamp to 0x1f
    }
  } else {
    m.step(0x1940, 7);               // jr nz not taken -- bit0 clear
    regs.a = regs.srl(regs.a);       m.step(0x1942, 8);
    regs.b = regs.a;                 m.step(0x1943, 4);
    regs.a = mem.read8(0x8820);      m.step(0x1946, 13);
    regs.add(regs.b);                m.step(0x1947, 4);
    regs.b = regs.a;                 m.step(0x1948, 4);
    regs.a = mem.read8(0x8903);      m.step(0x194b, 13);
    regs.add(regs.b);                m.step(0x194c, 4);
    regs.b = regs.a;                 m.step(0x194d, 4);
    regs.cp(0x20);                   m.step(0x194f, 7);
    if (regs.fC) {
      m.step(0x1953, 12);            // jr c,0x1953
    } else {
      m.step(0x1951, 7);
      regs.a = 0x1f;                 m.step(0x1953, 7); // clamp to 0x1f
    }
    m.step(0x1960, 12);              // 1953  jr 0x1960
  }

  // loc_1960: commit the column and clear the associated flags
  mem.write8(0x8900, regs.a);        m.step(0x1963, 13);
  regs.xor(regs.a);                  m.step(0x1964, 4);
  mem.write8(0x8a87, regs.a);        m.step(0x1967, 13);
  mem.write8(0x8905, regs.a);        m.step(0x196a, 13);
  mem.write8(0x8906, regs.a);        m.step(0x196d, 13);
  return m.ret(10);
}
