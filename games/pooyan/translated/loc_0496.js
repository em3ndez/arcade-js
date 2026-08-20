// SPDX-License-Identifier: GPL-3.0-only

// loc_0496  (ROM 0x0496-0x04f1) -- score credit + high-score update for the active player.
// Gated on 0x8806 bit0. Index A picks a 3-byte BCD increment from table 0x0501 (stride 3);
// A==0 takes the per-frame increment at 0x88ab instead. The increment is BCD-added (loc_04af)
// into the player's counter (DE from loc_04f2), the column is re-rendered (loc_056b), then the
// new value is compared MSB-first against the high score at 0x88aa; if higher it is copied to
// 0x88a8 and re-rendered with selector 2. loc_04f2 sets DE and preserves AF; loc_056b clobbers
// regs but every register loc_0496 needs afterward is reloaded (DE via the push/pop pair).
export function loc_0496(m) {
  const { regs, mem } = m;

  regs.c = regs.a;                 m.step(0x0497, 4);
  regs.a = mem.read8(0x8806);      m.step(0x049a, 13);
  regs.rrca();                     m.step(0x049b, 4);  // carry = bit0 gate
  if (regs.fNC) { return m.ret(11); } // ret nc -- gate closed
  m.step(0x049c, 5);
  regs.a = regs.c;                 m.step(0x049d, 4);
  regs.and(regs.a);                m.step(0x049e, 4);
  if (regs.fZ) {
    m.step(0x04e7, 12);            // jr z -- A==0: per-frame increment path
    m.push16(0x04ea);
    m.step(0x04f2, 17);            // 04e7  call 0x04f2 (DE = active counter, pattern A -> 0x04ea)
    m.call(0x04f2);
    regs.hl = 0x88ab;             m.step(0x04ed, 10);
    regs.and(regs.a);             m.step(0x04ee, 4);  // clear carry for the BCD chain
    regs.b = 0x03;                m.step(0x04f0, 7);
    m.step(0x04af, 12);           // jr 0x04af
  } else {
    m.step(0x04a0, 7);            // jr z not taken
    m.push16(0x04a3);
    m.step(0x04f2, 17);           // 04a0  call 0x04f2 (DE = active counter, pattern A -> 0x04a3)
    m.call(0x04f2);
    regs.add(regs.a);             m.step(0x04a4, 4);  // add a,a
    regs.add(regs.c);             m.step(0x04a5, 4);  // add a,c -> A = 3*index
    regs.c = regs.a;              m.step(0x04a6, 4);
    regs.b = 0x00;                m.step(0x04a8, 7);
    regs.hl = 0x0501;             m.step(0x04ab, 10);
    regs.addHl(regs.bc);          m.step(0x04ac, 11); // HL = table entry
    regs.and(regs.a);             m.step(0x04ad, 4);  // clear carry for the BCD chain
    regs.b = 0x03;                m.step(0x04af, 7);
  }

  // loc_04af: 3-byte BCD add mem[DE] += mem[HL] (carry chained through daa)
  for (;;) {
    regs.a = mem.read8(regs.de);      m.step(0x04b0, 7);
    regs.adc(mem.read8(regs.hl));     m.step(0x04b1, 7);
    regs.daa();                       m.step(0x04b2, 4);
    mem.write8(regs.de, regs.a);      m.step(0x04b3, 7);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x04b4, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x04b5, 6);
    if (regs.djnz()) { m.step(0x04af, 13); } else { m.step(0x04b7, 8); break; }
  }

  // loc_04b7: render the counter (selector from 0x880d bit0), then reload DE
  m.push16(regs.de);               m.step(0x04b8, 11);
  regs.a = mem.read8(0x880d);      m.step(0x04bb, 13);
  regs.rrca();                     m.step(0x04bc, 4);
  if (regs.fNC) {
    m.step(0x04c0, 12);            // jr nc -- selector A unchanged
  } else {
    m.step(0x04be, 7);
    regs.a = 0x01;                 m.step(0x04c0, 7);
  }
  m.push16(0x04c3);
  m.step(0x056b, 17);              // 04c0  call 0x056b (render column, pattern A -> 0x04c3)
  m.call(0x056b);
  regs.de = m.pop16();             m.step(0x04c4, 10);
  regs.de = (regs.de - 1) & 0xffff; m.step(0x04c5, 6); // point at MSB
  regs.hl = 0x88aa;                m.step(0x04c8, 10);
  regs.b = 0x03;                   m.step(0x04ca, 7);

  // loc_04ca: compare new value (DE, descending) with high score (0x88aa, descending)
  for (;;) {
    regs.a = mem.read8(regs.de);      m.step(0x04cb, 7);
    regs.cp(mem.read8(regs.hl));      m.step(0x04cc, 7);
    if (regs.fC) { return m.ret(11); } // ret c -- new < stored, no update
    m.step(0x04cd, 5);
    if (regs.fNZ) { m.step(0x04d4, 12); break; } // jr nz -- new > stored, update
    m.step(0x04cf, 7);
    regs.de = (regs.de - 1) & 0xffff; m.step(0x04d0, 6);
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x04d1, 6);
    if (regs.djnz()) { m.step(0x04ca, 13); } else { m.step(0x04d3, 8); return m.ret(10); } // all equal
  }

  // loc_04d4: copy the new value into the high score at 0x88a8, re-render with selector 2
  m.push16(0x04d7);
  m.step(0x04f2, 17);              // 04d4  call 0x04f2 (DE = active counter again, pattern A -> 0x04d7)
  m.call(0x04f2);
  regs.hl = 0x88a8;                m.step(0x04da, 10);
  regs.b = 0x03;                   m.step(0x04dc, 7);
  for (;;) {
    regs.a = mem.read8(regs.de);      m.step(0x04dd, 7);
    mem.write8(regs.hl, regs.a);      m.step(0x04de, 7);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x04df, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x04e0, 6);
    if (regs.djnz()) { m.step(0x04dc, 13); } else { m.step(0x04e2, 8); break; }
  }
  regs.a = 0x02;                   m.step(0x04e4, 7);
  m.step(0x056b, 10);              // jp 0x056b (tail)
  return m.call(0x056b);
}
