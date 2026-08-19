// SPDX-License-Identifier: GPL-3.0-only

// ROM range 0x1d0d-0x1dca = five entry points the batch lumped under "loc_1d0d". Interior
// branch/loop targets (loc_1d62, loc_1d82, loc_1da7, loc_1db7/1dbc/1dc1) are inlined; labels
// with external callers (loc_1d3c: jp z from 0x1a25/0x1a78) are delegated, not inlined.
// Un-annotated instruction addresses = the previous m.step's nextAddr argument.

// loc_1d0d -- set (0x8740)=1, then tail-jump to 0x1cec (before this range: boundary delegate).
export function loc_1d0d(m) {
  const { regs, mem } = m;

  regs.hl = 0x8740;              m.step(0x1d10, 10);
  mem.write8(regs.hl, 0x01);     m.step(0x1d12, 10); // ld (hl),0x01
  m.step(0x1cec, 12);            // jr 0x1cec
  return m.call(0x1cec);
}

// loc_1d15 -- clear sprite RAM (rst 0x10 fill), then branch on (0x880e)/(0x8802): call 0x1d0d
// or 0x1ce7, and either delegate to loc_1d3c (jr z) or seed the (0x8805)/(0x881f) restart bytes.
export function loc_1d15(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);             m.step(0x1d16, 4);
  regs.hl = 0x8900;             m.step(0x1d19, 10);
  regs.b = 0xbf;                m.step(0x1d1b, 7);
  m.push16(0x1d1c); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 fill
  regs.a = mem.read8(0x880e);   m.step(0x1d1f, 13);
  regs.and(regs.a);             m.step(0x1d20, 4);
  if (regs.fZ) { m.push16(0x1d23); m.step(0x1d0d, 17); m.call(0x1d0d); } // call z,0x1d0d
  else { m.step(0x1d23, 10); }
  if (regs.fNZ) { m.push16(0x1d26); m.step(0x1ce7, 17); m.call(0x1ce7); } // call nz,0x1ce7
  else { m.step(0x1d26, 10); }
  regs.a = mem.read8(0x8802);   m.step(0x1d29, 13);
  regs.and(regs.a);             m.step(0x1d2a, 4);
  if (regs.fZ) { m.step(0x1d3c, 12); return m.call(0x1d3c); } // jr z,0x1d3c -> delegate
  m.step(0x1d2c, 7);
  regs.xor(regs.a);             m.step(0x1d2d, 4);
  mem.write8(0x8806, regs.a);   m.step(0x1d30, 13);
  mem.write8(0x880a, regs.a);   m.step(0x1d33, 13);
  regs.a = regs.inc8(regs.a);   m.step(0x1d34, 4);
  mem.write8(0x881f, regs.a);   m.step(0x1d37, 13);
  regs.a = regs.inc8(regs.a);   m.step(0x1d38, 4);
  mem.write8(0x8805, regs.a);   m.step(0x1d3b, 13);
  return m.ret();
}

// loc_1d3c -- reset a block of play state, call 0x02b9/0x0ecf, then copy the halved bytes of the
// table at 0x1e4c into 0x89f0.. until a 0x7f terminator (loc_1d62 loop). Also an external entry.
export function loc_1d3c(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);             m.step(0x1d3d, 4);
  mem.write8(0x8806, regs.a);   m.step(0x1d40, 13);
  mem.write8(0x880a, regs.a);   m.step(0x1d43, 13);
  mem.write8(0x880d, regs.a);   m.step(0x1d46, 13);
  mem.write8(0x880e, regs.a);   m.step(0x1d49, 13);
  mem.write8(0x8e51, regs.a);   m.step(0x1d4c, 13);
  regs.a = regs.inc8(regs.a);   m.step(0x1d4d, 4);
  mem.write8(0x8805, regs.a);   m.step(0x1d50, 13);
  mem.write8(0x881f, regs.a);   m.step(0x1d53, 13);
  mem.write8(0x8f3f, regs.a);   m.step(0x1d56, 13);
  m.push16(0x1d59); m.step(0x02b9, 17); m.call(0x02b9);
  m.push16(0x1d5c); m.step(0x0ecf, 17); m.call(0x0ecf);
  regs.de = 0x1e4c;             m.step(0x1d5f, 10);
  regs.hl = 0x89f0;             m.step(0x1d62, 10);
  for (;;) {
    // loc_1d62
    regs.a = mem.read8(regs.de);      m.step(0x1d63, 7);
    regs.cp(0x7f);                    m.step(0x1d65, 7);
    if (regs.fZ) { return m.ret(11); } // ret z (terminator)
    m.step(0x1d66, 5);
    regs.a = regs.srl(regs.a);        m.step(0x1d68, 8); // srl a
    mem.write8(regs.hl, regs.a);      m.step(0x1d69, 7);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1d6a, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1d6b, 6);
    m.step(0x1d62, 12);               // jr 0x1d62
  }
}

// loc_1d6e -- (0x8f4a) countdown; at value 0x40 fire the 0x79e9/rst-0x38/0x0f44 event, otherwise
// (loc_1d82) when it reached zero re-seat (0x8f50)/(0x8d07) and maybe raise (0x8f61).
export function loc_1d6e(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f4a;             m.step(0x1d71, 10);
  regs.a = mem.read8(regs.hl);  m.step(0x1d72, 7);  // ld a,(hl)
  regs.decMem8(mem, regs.hl);   m.step(0x1d73, 11); // dec (hl)
  regs.cp(0x40);                m.step(0x1d75, 7);
  if (regs.fZ) {
    m.step(0x1d77, 7);          // jr nz not taken -> (hl was 0x40)
    m.push16(0x1d7a); m.step(0x79e9, 17); m.call(0x79e9);
    regs.de = 0x0626;           m.step(0x1d7d, 10);
    m.push16(0x1d7e); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
    m.push16(0x1d81); m.step(0x0f44, 17); m.call(0x0f44);
    return m.ret();
  }
  m.step(0x1d82, 12);           // jr nz taken
  // loc_1d82
  regs.and(regs.a);             m.step(0x1d83, 4);
  if (regs.fNZ) { return m.ret(11); } // ret nz (not yet zero)
  m.step(0x1d84, 5);
  mem.write8(0x880a, regs.a);   m.step(0x1d87, 13);
  regs.l = 0x50;                m.step(0x1d89, 7);  // hl -> 0x8f50
  mem.write8(regs.hl, 0x02);    m.step(0x1d8b, 10);
  regs.hl = 0x8d07;             m.step(0x1d8e, 10);
  mem.write8(regs.hl, 0x40);    m.step(0x1d90, 10);
  regs.a = mem.read8(0x8907);   m.step(0x1d93, 13);
  regs.bit(1, regs.a);          m.step(0x1d95, 8);
  if (regs.fNZ) { return m.ret(11); } // ret nz
  m.step(0x1d96, 5);
  regs.a = 0x01;                m.step(0x1d98, 7);
  mem.write8(0x8f61, regs.a);   m.step(0x1d9b, 13);
  return m.ret();
}

// loc_1d9c -- if (0x8907) bit1 clear just call 0x0fd5; else (loc_1da7) call 0x6da6 and count set
// bit0 + clear bit3 across 0x20 reads of the ROM cell 0x5a28, raising (0x89e7) unless the tally==C.
export function loc_1d9c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);   m.step(0x1d9f, 13);
  regs.bit(1, regs.a);          m.step(0x1da1, 8);
  if (regs.fZ) {
    m.step(0x1da3, 7);          // jr nz not taken
    m.push16(0x1da6); m.step(0x0fd5, 17); m.call(0x0fd5);
    return m.ret();
  }
  m.step(0x1da7, 12);           // jr nz taken -> loc_1da7
  m.push16(0x1daa); m.step(0x6da6, 17); m.call(0x6da6);
  regs.hl = 0x584c;             m.step(0x1dad, 10);
  regs.a = regs.l;              m.step(0x1dae, 4);
  regs.sub(0x24);               m.step(0x1db0, 7);
  regs.l = regs.a;              m.step(0x1db1, 4);
  regs.h = regs.inc8(regs.h);   m.step(0x1db2, 4);
  regs.h = regs.inc8(regs.h);   m.step(0x1db3, 4); // hl -> 0x5a28
  regs.bc = 0x2020;             m.step(0x1db6, 10);
  regs.xor(regs.a);             m.step(0x1db7, 4);
  for (;;) {
    // loc_1db7
    regs.bit(0, mem.read8(regs.hl));  m.step(0x1db9, 12);
    if (regs.fZ) { m.step(0x1dbc, 12); }               // jr z taken, skip inc a
    else { m.step(0x1dbb, 7); regs.a = regs.inc8(regs.a); m.step(0x1dbc, 4); }
    // loc_1dbc
    regs.bit(3, mem.read8(regs.hl));  m.step(0x1dbe, 12);
    if (regs.fNZ) { m.step(0x1dc1, 12); }              // jr nz taken, skip inc a
    else { m.step(0x1dc0, 7); regs.a = regs.inc8(regs.a); m.step(0x1dc1, 4); }
    // loc_1dc1
    if (regs.djnz() !== 0) { m.step(0x1db7, 13); continue; }
    m.step(0x1dc3, 8);
    break;
  }
  regs.cp(regs.c);              m.step(0x1dc4, 4); // cp c
  if (regs.fZ) { return m.ret(11); } // ret z
  m.step(0x1dc5, 5);
  regs.a = 0x01;                m.step(0x1dc7, 7);
  mem.write8(0x89e7, regs.a);   m.step(0x1dca, 13);
  return m.ret();
}
