// SPDX-License-Identifier: GPL-3.0-only

// loc_19ca  (ROM 0x19ca-0x19ed) -- periodic warning-siren tick. Gated on (0x8806)==0 and
// (0x8d68)!=0; a countdown at 0x8d6a expires every N frames, reloads to 0x18, then toggles a
// phase bit at 0x8d69 (bit0). Each phase queues a different sound command via rst 0x38 (DE =
// 0x060f or 0x068f) and resets the phase byte to 0x01 / 0x00.
export function loc_19ca(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8806);        m.step(0x19cd, 13);
  regs.and(regs.a);                  m.step(0x19ce, 4);
  if (regs.fNZ) { return m.ret(11); } // 19ce  ret nz
  m.step(0x19cf, 5);

  regs.a = mem.read8(0x8d68);        m.step(0x19d2, 13);
  regs.and(regs.a);                  m.step(0x19d3, 4);
  if (regs.fZ) { return m.ret(11); }  // 19d3  ret z
  m.step(0x19d4, 5);

  regs.hl = 0x8d6a;                  m.step(0x19d7, 10);
  regs.decMem8(mem, regs.hl);        m.step(0x19d8, 11); // 19d7  dec (hl)
  if (regs.fNZ) { return m.ret(11); } // 19d8  ret nz -- not expired yet
  m.step(0x19d9, 5);

  mem.write8(regs.hl, 0x18);         m.step(0x19db, 10); // reload countdown
  regs.l = regs.dec8(regs.l);        m.step(0x19dc, 4);  // dec l -> HL=0x8d69 (phase byte)
  regs.bit(0, mem.read8(regs.hl));   m.step(0x19de, 12); // bit 0,(hl)
  if (regs.fNZ) {
    m.step(0x19e7, 12);              // jr nz,0x19e7 taken -- phase B
    mem.write8(regs.hl, 0x00);       m.step(0x19e9, 10);
    regs.de = 0x068f;                m.step(0x19ec, 10);
    m.push16(0x19ed); m.step(0x0038, 11); m.call(0x0038); // 19ec  rst 0x38
    return m.ret(10);                // 19ed  ret
  }
  m.step(0x19e0, 7);                 // jr nz not taken -- phase A

  mem.write8(regs.hl, 0x01);         m.step(0x19e2, 10);
  regs.de = 0x060f;                  m.step(0x19e5, 10);
  m.push16(0x19e6); m.step(0x0038, 11); m.call(0x0038); // 19e5  rst 0x38
  return m.ret(10);                  // 19e6  ret
}
