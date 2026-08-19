// SPDX-License-Identifier: GPL-3.0-only

// ROM range 0x0cf8-0x0dff = six entry points the batch lumped under "loc_0cf8". Interior
// branch/loop targets (loc_0d04, loc_0d21, loc_0d6d, loc_0d95, loc_0d9b, loc_0df4) are inlined;
// labels with external callers (loc_0d78 = the loc_0c4e handler's ret target; loc_0da8/loc_0dab =
// jp from 0x0c19/0x0c10) are delegated. Un-annotated addresses = the previous m.step's nextAddr.

// loc_0cf8 -- copy a 0x0c-byte column table into sprite bank(s), striding IX by -0x20. Reads the
// table at 0x0d2f (then 0x0d48 after the 0xff switch marker); a 0xee marker ends the copy.
export function loc_0cf8(m) {
  const { regs, mem } = m;

  regs.hl = 0x0d2f;             m.step(0x0cfb, 10);
  regs.ix = 0x86a7;             m.step(0x0cff, 14);
  regs.de = 0xffe0;             m.step(0x0d02, 10);
  regs.b = 0x0c;                m.step(0x0d04, 7);
  for (;;) {
    // loc_0d04 inner copy loop
    for (;;) {
      regs.a = mem.read8(regs.hl);       m.step(0x0d05, 7);
      mem.write8(regs.ix, regs.a);       m.step(0x0d08, 19); // ld (ix+0),a
      regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x0d09, 6);
      regs.addIx(regs.de);               m.step(0x0d0b, 15); // add ix,de
      if (regs.djnz() !== 0) { m.step(0x0d04, 13); continue; }
      m.step(0x0d0d, 8);
      break;
    }
    regs.a = mem.read8(regs.hl);  m.step(0x0d0e, 7);
    regs.cp(0xff);                m.step(0x0d10, 7);
    if (regs.fZ) {
      // loc_0d21: switch to the second table/bank
      m.step(0x0d21, 12);         // jr z taken
      regs.hl = 0x0d48;           m.step(0x0d24, 10);
      regs.ix = 0x82a7;           m.step(0x0d28, 14);
      regs.de = 0xffe0;           m.step(0x0d2b, 10);
      regs.b = 0x0c;              m.step(0x0d2d, 7);
      m.step(0x0d04, 12);         // jr 0x0d04
      continue;
    }
    m.step(0x0d12, 7);            // jr z not taken
    regs.cp(0xee);                m.step(0x0d14, 7);
    if (regs.fZ) { return m.ret(11); } // ret z (end marker)
    m.step(0x0d15, 5);
    regs.de = 0x0181;             m.step(0x0d18, 10);
    regs.addIx(regs.de);          m.step(0x0d1a, 15); // add ix,de (next block)
    regs.de = 0xffe0;             m.step(0x0d1d, 10);
    regs.b = 0x0c;                m.step(0x0d1f, 7);
    m.step(0x0d04, 12);           // jr 0x0d04
  }
}

// loc_0d61 -- fire one of two rst-0x38 sound events keyed off (0x8802) (0x0618/0x0619), then a
// fixed 0x0300 event, and set (0x8805)=2. loc_0d6d is the inlined merge point.
export function loc_0d61(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8802);   m.step(0x0d64, 13);
  regs.and(regs.a);             m.step(0x0d65, 4);
  if (regs.fZ) { return m.ret(11); } // ret z
  m.step(0x0d66, 5);
  regs.a = regs.dec8(regs.a);   m.step(0x0d67, 4); // dec a
  regs.de = 0x0618;             m.step(0x0d6a, 10);
  if (regs.fZ) { m.step(0x0d6d, 12); }             // jr z taken, keep 0x0618
  else { m.step(0x0d6c, 7); regs.e = regs.inc8(regs.e); m.step(0x0d6d, 4); } // -> 0x0619
  // loc_0d6d
  m.push16(0x0d6e); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  regs.de = 0x0300;             m.step(0x0d71, 10);
  m.push16(0x0d72); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  regs.a = 0x02;                m.step(0x0d74, 7);
  mem.write8(0x8805, regs.a);   m.step(0x0d77, 13);
  return m.ret();
}

// loc_0d78 -- coin/credit post-handler on (0x8810) bits. bit3 -> delegate loc_0de4; bit4 clear ->
// return; else subtract 2 credits, checksum the 0x14 bytes at 0x776b (bump (0x89ea) if !=0), and
// fall through to loc_0da8 (HL=0x0100) unless the checksum was zero (jr z, HL untouched).
export function loc_0d78(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8810);   m.step(0x0d7b, 13);
  regs.bit(3, regs.a);          m.step(0x0d7d, 8);
  if (regs.fNZ) { m.step(0x0de4, 10); return m.call(0x0de4); } // jp nz,0x0de4
  m.step(0x0d80, 10);
  regs.bit(4, regs.a);          m.step(0x0d82, 8);
  if (regs.fZ) { return m.ret(11); } // ret z
  m.step(0x0d83, 5);
  regs.a = mem.read8(0x8802);   m.step(0x0d86, 13);
  regs.cp(0x02);                m.step(0x0d88, 7);
  if (regs.fC) { return m.ret(11); } // ret c
  m.step(0x0d89, 5);
  regs.sub(0x02);               m.step(0x0d8b, 7);
  mem.write8(0x8802, regs.a);   m.step(0x0d8e, 13);
  regs.hl = 0x776b;             m.step(0x0d91, 10);
  regs.b = 0x14;                m.step(0x0d93, 7);
  regs.e = regs.b;              m.step(0x0d94, 4);
  regs.d = regs.e;              m.step(0x0d95, 4);
  for (;;) {
    // loc_0d95: 16-bit sum in DE
    regs.a = mem.read8(regs.hl);      m.step(0x0d96, 7);
    regs.add(regs.e);                 m.step(0x0d97, 4); // add a,e
    regs.e = regs.a;                  m.step(0x0d98, 4);
    if (regs.fNC) { m.step(0x0d9b, 12); }              // jr nc taken
    else { m.step(0x0d9a, 7); regs.d = regs.inc8(regs.d); m.step(0x0d9b, 4); }
    // loc_0d9b
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0d9c, 6);
    if (regs.djnz() !== 0) { m.step(0x0d95, 13); continue; }
    m.step(0x0d9e, 8);
    break;
  }
  regs.a = regs.e;              m.step(0x0d9f, 4);
  regs.add(regs.d);             m.step(0x0da0, 4); // add a,d
  regs.and(0xab);               m.step(0x0da2, 7);
  if (regs.fZ) { m.step(0x0da8, 12); return m.call(0x0da8); } // jr z,0x0da8
  m.step(0x0da4, 7);
  regs.hl = 0x89ea;             m.step(0x0da7, 10);
  regs.incMem8(mem, regs.hl);   m.step(0x0da8, 11); // inc (hl)
  return m.call(0x0da8);        // fall through to loc_0da8
}

// loc_0da8 -- seat HL=0x0100 then fall through to loc_0dab.
export function loc_0da8(m) {
  const { regs } = m;

  regs.hl = 0x0100;             m.step(0x0dab, 10);
  return m.call(0x0dab);
}

// loc_0dab -- start-of-life setup: (0x880d)=HL, call 0x0e54, seed (0x8805)/(0x8806)/(0x881f),
// fire the 0x0604/0x0400 rst-0x38 events, call 0x0e00, seat the 0x8d21 pair, and on (0x880e) bit0
// fire the 0x0401 event + clear the 0x8e1f block (rst 0x10).
export function loc_0dab(m) {
  const { regs, mem } = m;

  mem.write16(0x880d, regs.hl);         m.step(0x0dae, 16); // ld (0x880d),hl
  m.push16(0x0db1); m.step(0x0e54, 17); m.call(0x0e54);
  regs.xor(regs.a);             m.step(0x0db2, 4);
  mem.write8(0x880a, regs.a);   m.step(0x0db5, 13);
  regs.a = 0x03;                m.step(0x0db7, 7);
  mem.write8(0x8805, regs.a);   m.step(0x0dba, 13);
  regs.a = 0x01;                m.step(0x0dbc, 7);
  mem.write8(0x8806, regs.a);   m.step(0x0dbf, 13);
  mem.write8(0x881f, regs.a);   m.step(0x0dc2, 13);
  regs.de = 0x0604;             m.step(0x0dc5, 10);
  m.push16(0x0dc6); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  m.push16(0x0dc9); m.step(0x0e00, 17); m.call(0x0e00);
  regs.hl = 0x8d21;             m.step(0x0dcc, 10);
  mem.write8(regs.hl, 0x00);    m.step(0x0dce, 10);
  regs.l = regs.inc8(regs.l);   m.step(0x0dcf, 4); // inc l
  mem.write8(regs.hl, 0x20);    m.step(0x0dd1, 10);
  regs.de = 0x0400;             m.step(0x0dd4, 10);
  m.push16(0x0dd5); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  regs.a = mem.read8(0x880e);   m.step(0x0dd8, 13);
  regs.rrca();                  m.step(0x0dd9, 4);
  if (regs.fNC) { return m.ret(11); } // ret nc
  m.step(0x0dda, 5);
  regs.e = regs.inc8(regs.e);   m.step(0x0ddb, 4); // inc e -> 0x0401
  m.push16(0x0ddc); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  regs.xor(regs.a);             m.step(0x0ddd, 4);
  regs.hl = 0x8e1f;             m.step(0x0de0, 10);
  regs.b = 0x0c;                m.step(0x0de2, 7);
  m.push16(0x0de3); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 fill
  return m.ret();
}

// loc_0de4 -- (0x8810) bit3 branch: if (0x8802)!=0 decrement it and restart via loc_0dab (HL=0),
// else (loc_0df4) when (0x880a)!=0x0e set (0x8805)=1.
export function loc_0de4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8802);   m.step(0x0de7, 13);
  regs.and(regs.a);             m.step(0x0de8, 4);
  if (regs.fNZ) {
    m.step(0x0dea, 7);          // jr z not taken
    regs.a = regs.dec8(regs.a); m.step(0x0deb, 4);
    mem.write8(0x8802, regs.a); m.step(0x0dee, 13);
    regs.hl = 0x0000;           m.step(0x0df1, 10);
    m.step(0x0dab, 10);         // jp 0x0dab
    return m.call(0x0dab);
  }
  m.step(0x0df4, 12);           // jr z taken
  // loc_0df4
  regs.a = mem.read8(0x880a);   m.step(0x0df7, 13);
  regs.cp(0x0e);                m.step(0x0df9, 7);
  if (regs.fZ) { return m.ret(11); } // ret z
  m.step(0x0dfa, 5);
  regs.a = 0x01;                m.step(0x0dfc, 7);
  mem.write8(0x8805, regs.a);   m.step(0x0dff, 13);
  return m.ret();
}
