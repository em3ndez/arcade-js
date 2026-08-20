// SPDX-License-Identifier: GPL-3.0-only

// loc_5fa2  (ROM 0x5fa2-0x6017, incl. the 0x6025 branch) -- one pass of the 6-slot overlap scan.
// Empty / non-type-5 slots tail-jump to loc_6018 (the advance + djnz-back latch). Otherwise it
// computes |dx|,|dy| between slot (IX) and target (IY) and applies per-axis thresholds (X 0x10/0x08,
// Y 0x12/0x08; the tighter value when C==3), bailing to loc_6018 on any miss. On a full hit: C==3 ->
// loc_6025 marks 0x8d45 and tail-jumps the untranslated boundary 0x613d; otherwise it flags the two
// record cells, calls loc_0f01, then `pop af`+`ret` return TWO frames up (past the caller's loop) --
// modelled with pop16/ret so the stack unwinds correctly.
export function loc_5fa2(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);   m.step(0x5fa3, 7);
  regs.and(regs.a);              m.step(0x5fa4, 4);
  if (regs.fZ) { m.step(0x6018, 12); return m.call(0x6018); } // 5fa4 jr z (empty slot)
  m.step(0x5fa6, 7);

  regs.l = regs.inc8(regs.l);    m.step(0x5fa7, 4);
  regs.l = regs.inc8(regs.l);    m.step(0x5fa8, 4);
  regs.a = mem.read8(regs.hl);   m.step(0x5fa9, 7);
  regs.l = regs.dec8(regs.l);    m.step(0x5faa, 4);
  regs.l = regs.dec8(regs.l);    m.step(0x5fab, 4);
  regs.cp(0x05);                 m.step(0x5fad, 7);
  if (regs.fNZ) { m.step(0x6018, 12); return m.call(0x6018); } // 5fad jr nz (not type 5)
  m.step(0x5faf, 7);

  regs.e = 0x06;                 m.step(0x5fb1, 7);
  regs.a = mem.read8(0x881f);    m.step(0x5fb4, 13);
  regs.and(regs.a);              m.step(0x5fb5, 4);
  if (regs.fNZ) {
    m.step(0x5fb9, 12);
  } else {
    m.step(0x5fb7, 7);
    regs.e = 0xfb;               m.step(0x5fb9, 7);
  }

  // dx = |(iy+0) - ((ix+0) + e)|
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x5fbc, 19);
  regs.add(regs.e);              m.step(0x5fbd, 4);
  regs.e = regs.a;               m.step(0x5fbe, 4);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x5fc1, 19);
  regs.add(0x08);                m.step(0x5fc3, 7);
  regs.d = regs.a;               m.step(0x5fc4, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x5fc7, 19);
  regs.sub(regs.e);              m.step(0x5fc8, 4);
  if (regs.fNC) {
    m.step(0x5fcc, 12);
  } else {
    m.step(0x5fca, 7);
    regs.neg();                  m.step(0x5fcc, 8);
  }
  regs.e = regs.a;               m.step(0x5fcd, 4);
  regs.a = regs.c;               m.step(0x5fce, 4);
  regs.cp(0x03);                 m.step(0x5fd0, 7);
  regs.a = regs.e;               m.step(0x5fd1, 4); // ld a,e: flags stay from cp 0x03
  if (regs.fNZ) {
    m.step(0x5fd9, 12);          // C!=3
    regs.cp(0x08);               m.step(0x5fdb, 7);
    if (regs.fNC) { m.step(0x6018, 12); return m.call(0x6018); } // 5fdb dx>=8 miss
    m.step(0x5fdd, 7);
  } else {
    m.step(0x5fd3, 7);           // C==3
    regs.cp(0x10);               m.step(0x5fd5, 7);
    if (regs.fNC) { m.step(0x6018, 12); return m.call(0x6018); } // 5fd5 dx>=0x10 miss
    m.step(0x5fd7, 7);
    m.step(0x5fdd, 12);          // 5fd7 jr 0x5fdd
  }

  // dy = |(iy+2) + 8 - ((ix+2) + 8)|
  regs.a = mem.read8((regs.iy + 0x02) & 0xffff); m.step(0x5fe0, 19);
  regs.add(0x08);                m.step(0x5fe2, 7);
  regs.sub(regs.d);              m.step(0x5fe3, 4);
  if (regs.fNC) {
    m.step(0x5fe7, 12);
  } else {
    m.step(0x5fe5, 7);
    regs.neg();                  m.step(0x5fe7, 8);
  }
  regs.e = regs.a;               m.step(0x5fe8, 4);
  regs.a = regs.c;               m.step(0x5fe9, 4);
  regs.cp(0x03);                 m.step(0x5feb, 7);
  regs.a = regs.e;               m.step(0x5fec, 4); // ld a,e: flags stay from cp 0x03
  if (regs.fNZ) {
    m.step(0x5ff4, 12);          // C!=3
    regs.cp(0x08);               m.step(0x5ff6, 7);
    if (regs.fNC) { m.step(0x6018, 12); return m.call(0x6018); } // 5ff6 dy>=8 miss
    m.step(0x5ff8, 7);
  } else {
    m.step(0x5fee, 7);           // C==3
    regs.cp(0x12);               m.step(0x5ff0, 7);
    if (regs.fNC) { m.step(0x6018, 12); return m.call(0x6018); } // 5ff0 dy>=0x12 miss
    m.step(0x5ff2, 7);
    m.step(0x5ff8, 12);          // 5ff2 jr 0x5ff8
  }

  regs.a = regs.c;               m.step(0x5ff9, 4);
  regs.cp(0x03);                 m.step(0x5ffb, 7);
  if (regs.fZ) {
    // 5ffb jr z,0x6025 -- C==3 hit: IY<-HL, mark 0x8d45, tail-jump boundary 0x613d
    m.step(0x6025, 12);
    m.push16(regs.hl);           m.step(0x6026, 11);
    regs.iy = m.pop16();         m.step(0x6028, 14);
    regs.hl = 0x8d45;            m.step(0x602b, 10);
    regs.incMem8(mem, regs.hl);  m.step(0x602c, 11);
    m.step(0x613d, 10);
    return m.call(0x613d);
  }
  m.step(0x5ffd, 7);

  // general hit: HL<-IY, flag two cells, call loc_0f01, then return two frames up
  m.push16(regs.iy);             m.step(0x5fff, 15);
  regs.hl = m.pop16();           m.step(0x6000, 10);
  regs.a = regs.l;               m.step(0x6001, 4);
  regs.hl = 0x8c91;              m.step(0x6004, 10);
  regs.cp(0x48);                 m.step(0x6006, 7);
  if (regs.fZ) {
    m.step(0x600b, 12);
  } else {
    m.step(0x6008, 7);
    regs.hl = 0x8ca9;            m.step(0x600b, 10);
  }
  mem.write8(regs.hl, 0x01);     m.step(0x600d, 10);
  regs.de = 0x0006;              m.step(0x6010, 10);
  regs.addHl(regs.de);           m.step(0x6011, 11);
  mem.write8(regs.hl, 0x01);     m.step(0x6013, 10);
  m.push16(0x6016);
  m.step(0x0f01, 17);
  m.call(0x0f01);
  regs.af = m.pop16();           m.step(0x6017, 10); // pop af: discard the caller's frame
  return m.ret(10);              // ret: two frames up, out of the caller's loop
}
