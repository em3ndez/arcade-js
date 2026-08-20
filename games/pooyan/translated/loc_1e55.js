// SPDX-License-Identifier: GPL-3.0-only

// loc_1e55  (ROM 0x1e55-0x1ea6) -- per-frame update of the 0x8a80 object's byte 0x07 (its state
// bits). If either 0x89e5 or 0x89fb is nonzero, or the gate (0x8806) is zero, or byte 0x02 of the
// object is set, or 0x8f24|(0x8f57) is nonzero -> clear (ix+7) and ret. Otherwise reads an input
// (0xa0a0 or 0xa0c0 per 0x881f), complements it into (ix+7), rotates the top bit through the
// 0x8f03 latch (rl (hl)), and if the low-3 latch != 1 clears bit4 of (ix+7). No calls (leaf).
export function loc_1e55(m) {
  const { regs, mem } = m;

  regs.hl = 0x89e5;                  m.step(0x1e58, 10);
  regs.b = mem.read8(regs.hl);       m.step(0x1e59, 7);
  regs.a = regs.l;                   m.step(0x1e5a, 4);
  regs.add(0x16);                    m.step(0x1e5c, 7);
  regs.l = regs.a;                   m.step(0x1e5d, 4);  // HL -> 0x89fb
  regs.a = regs.b;                   m.step(0x1e5e, 4);
  regs.or(mem.read8(regs.hl));       m.step(0x1e5f, 7);
  regs.and(regs.a);                  m.step(0x1e60, 4);
  regs.ix = 0x8a80;                  m.step(0x1e64, 14);
  if (regs.fNZ) { m.step(0x1ea2, 12); return tail_1ea2(m); } // 0x89e5|0x89fb nonzero
  m.step(0x1e66, 7);

  regs.a = mem.read8(0x8806);        m.step(0x1e69, 13);
  regs.and(regs.a);                  m.step(0x1e6a, 4);
  if (regs.fZ) { return m.ret(11); } // ret z -- gate closed
  m.step(0x1e6b, 5);

  regs.iy = 0x8c90;                  m.step(0x1e6f, 14);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x1e72, 19);
  regs.and(regs.a);                  m.step(0x1e73, 4);
  if (regs.fNZ) { m.step(0x1ea2, 12); return tail_1ea2(m); } // object byte 2 set
  m.step(0x1e75, 7);

  regs.a = mem.read8(0x8f24);        m.step(0x1e78, 13);
  regs.hl = 0x8f57;                  m.step(0x1e7b, 10);
  regs.or(mem.read8(regs.hl));       m.step(0x1e7c, 7);
  if (regs.fNZ) { m.step(0x1ea2, 12); return tail_1ea2(m); } // 0x8f24|(0x8f57) nonzero
  m.step(0x1e7e, 7);

  regs.a = mem.read8(0x881f);        m.step(0x1e81, 13);
  regs.and(regs.a);                  m.step(0x1e82, 4);
  regs.a = mem.read8(0xa0a0);        m.step(0x1e85, 13); // ld does not disturb the and-a flags
  if (regs.fNZ) {
    m.step(0x1e8a, 12);              // jr nz,0x1e8a -- keep 0xa0a0
  } else {
    m.step(0x1e87, 7);
    regs.a = mem.read8(0xa0c0);      m.step(0x1e8a, 13);
  }

  // loc_1e8a: complement the input into (ix+7), then shift its top bit into the 0x8f03 latch
  regs.cpl();                        m.step(0x1e8b, 4);
  mem.write8((regs.ix + 0x07) & 0xffff, regs.a); m.step(0x1e8e, 19);
  regs.rla();                        m.step(0x1e8f, 4);
  regs.rla();                        m.step(0x1e90, 4);
  regs.rla();                        m.step(0x1e91, 4);
  regs.hl = 0x8f03;                  m.step(0x1e94, 10);
  regs.rla();                        m.step(0x1e95, 4);
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl))); m.step(0x1e97, 15); // rl (hl)
  regs.a = mem.read8(regs.hl);       m.step(0x1e98, 7);
  regs.and(0x07);                    m.step(0x1e9a, 7);
  regs.cp(0x01);                     m.step(0x1e9c, 7);
  if (regs.fZ) { return m.ret(11); } // ret z -- latch low-3 == 1, leave (ix+7) as-is
  m.step(0x1e9d, 5);
  mem.write8((regs.ix + 0x07) & 0xffff, regs.res(4, mem.read8((regs.ix + 0x07) & 0xffff))); m.step(0x1ea1, 23); // res 4,(ix+7)
  return m.ret(10);
}

// loc_1ea2: abort path -- zero the object's state byte and return.
function tail_1ea2(m) {
  const { regs, mem } = m;
  mem.write8((regs.ix + 0x07) & 0xffff, 0x00); m.step(0x1ea6, 19); // ld (ix+7),0x00
  return m.ret(10);
}
