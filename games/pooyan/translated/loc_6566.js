// SPDX-License-Identifier: GPL-3.0-only

// loc_6566  (ROM 0x6566-0x6665) -- (0x892f) phase down-counter driving an object-motion + RAM-mirror
// pass. While (0x892f)!=0 it just decrements and returns. On 0 it toggles (0x892c) bit0 to select an
// even (grow, seeds 0x06) or odd (shrink, seeds 0x0c) phase; each phase steps three mirrored ix
// records' X/size fields. The odd phase renders via 0x2514 (arg 0x66bf/0x66c2 by bit0) and returns.
// The even phase falls into the 0x8c78 record's integrity sweep: two 10-slot passes over the 0x82bc
// mirror bank -- a slot mismatch or bad checksum is a tamper trap (throw; 0x5284/0x6014/0x2005 are
// data, cf. loc_3278), else ret.
export function loc_6566(m) {
  const { regs, mem } = m;

  regs.hl = 0x892f;                m.step(0x6569, 10);
  regs.a = mem.read8(regs.hl);     m.step(0x656a, 7);
  regs.and(regs.a);               m.step(0x656b, 4);
  if (regs.fNZ) {
    m.step(0x656d, 7);            // jr z not taken
    regs.decMem8(mem, regs.hl);   m.step(0x656e, 11);
    return m.ret(10);            // 0x656e
  }
  m.step(0x656f, 12);            // jr z taken

  regs.l = 0x2c;                  m.step(0x6571, 7);
  regs.incMem8(mem, regs.hl);     m.step(0x6572, 11);
  regs.bit(0, mem.read8(regs.hl)); m.step(0x6574, 12);
  regs.l = 0x2f;                  m.step(0x6576, 7);
  if (regs.fNZ) {
    // odd phase (shrink)
    m.step(0x6596, 12);
    mem.write8(regs.hl, 0x0c);    m.step(0x6598, 10);
    regs.a = mem.read8((regs.ix + 3) & 0xffff);  m.step(0x659b, 19);
    regs.sub(mem.read8((regs.ix + 8) & 0xffff)); m.step(0x659e, 19);
    if (regs.fC) {
      m.step(0x65a0, 7);
      regs.decMem8(mem, (regs.ix + 4) & 0xffff);    m.step(0x65a3, 23);
      regs.decMem8(mem, (regs.ix - 0x14) & 0xffff); m.step(0x65a6, 23);
      regs.decMem8(mem, (regs.ix - 0x2c) & 0xffff); m.step(0x65a9, 23);
    } else {
      m.step(0x65a9, 12);
    }
    mem.write8((regs.ix + 3) & 0xffff, regs.a);    m.step(0x65ac, 19);
    mem.write8((regs.ix - 0x15) & 0xffff, regs.a); m.step(0x65af, 19);
    mem.write8((regs.ix - 0x2d) & 0xffff, regs.a); m.step(0x65b2, 19);
    regs.a = mem.read8((regs.ix + 5) & 0xffff);    m.step(0x65b5, 19);
    regs.sub(mem.read8((regs.ix + 9) & 0xffff));   m.step(0x65b8, 19);
    mem.write8((regs.ix + 5) & 0xffff, regs.a);    m.step(0x65bb, 19);
    mem.write8((regs.ix - 0x13) & 0xffff, regs.a); m.step(0x65be, 19);
    mem.write8((regs.ix - 0x2b) & 0xffff, regs.a); m.step(0x65c1, 19);
    if (regs.fC) {
      m.step(0x65c3, 7);
      regs.a = mem.read8((regs.ix + 6) & 0xffff);    m.step(0x65c6, 19);
      regs.sub(0x01);                                m.step(0x65c8, 7);
      mem.write8((regs.ix + 6) & 0xffff, regs.a);    m.step(0x65cb, 19);
      regs.sub(0x02);                                m.step(0x65cd, 7);
      mem.write8((regs.ix - 0x12) & 0xffff, regs.a); m.step(0x65d0, 19);
      regs.sub(0x02);                                m.step(0x65d2, 7);
      mem.write8((regs.ix - 0x2a) & 0xffff, regs.a); m.step(0x65d5, 19);
    } else {
      m.step(0x65d5, 12);
    }
    regs.l = 0x2c;                  m.step(0x65d7, 7);
    regs.bit(0, mem.read8(regs.hl)); m.step(0x65d9, 12);
    regs.hl = 0x66bf;              m.step(0x65dc, 10);
    if (regs.fNZ) {
      m.step(0x65de, 7);
      regs.hl = 0x66c2;            m.step(0x65e1, 10);
    } else {
      m.step(0x65e1, 12);
    }
    regs.de = 0xffe8;              m.step(0x65e4, 10);
    regs.b = 0x03;                m.step(0x65e6, 7);
    m.push16(0x65e9); m.step(0x2514, 17); m.call(0x2514);
    return m.ret(10);            // 0x65e9
  }

  // even phase (grow)
  m.step(0x6578, 7);             // jr nz not taken
  mem.write8(regs.hl, 0x06);      m.step(0x657a, 10);
  regs.a = mem.read8((regs.ix + 3) & 0xffff);  m.step(0x657d, 19);
  regs.add(mem.read8((regs.ix + 8) & 0xffff)); m.step(0x6580, 19);
  if (regs.fC) {
    m.step(0x6582, 7);
    regs.incMem8(mem, (regs.ix + 4) & 0xffff);    m.step(0x6585, 23);
    regs.incMem8(mem, (regs.ix - 0x14) & 0xffff); m.step(0x6588, 23);
    regs.incMem8(mem, (regs.ix - 0x2c) & 0xffff); m.step(0x658b, 23);
  } else {
    m.step(0x658b, 12);
  }
  mem.write8((regs.ix + 3) & 0xffff, regs.a);    m.step(0x658e, 19);
  mem.write8((regs.ix - 0x15) & 0xffff, regs.a); m.step(0x6591, 19);
  mem.write8((regs.ix - 0x2d) & 0xffff, regs.a); m.step(0x6594, 19);
  m.step(0x65ea, 12);           // jr 0x65ea

  // integrity sweep on the 0x8c78 record
  regs.ix = 0x8c78;              m.step(0x65ee, 14);
  regs.a = mem.read8((regs.ix + 6) & 0xffff); m.step(0x65f1, 19);
  regs.cp(0x0c);                m.step(0x65f3, 7);
  if (regs.fNC) { m.ret(11); return; } // ret nc
  m.step(0x65f4, 5);
  regs.a = 0x40;               m.step(0x65f6, 7);
  mem.write8((regs.ix + 0x10) & 0xffff, regs.a); m.step(0x65f9, 19);
  mem.write8((regs.ix - 0x08) & 0xffff, regs.a); m.step(0x65fc, 19);
  mem.write8((regs.ix - 0x20) & 0xffff, regs.a); m.step(0x65ff, 19);
  regs.a = 0x18;               m.step(0x6601, 7);
  mem.write8((regs.ix + 9) & 0xffff, regs.a);    m.step(0x6604, 19);
  mem.write8((regs.ix - 0x0f) & 0xffff, regs.a); m.step(0x6607, 19);
  mem.write8((regs.ix - 0x27) & 0xffff, regs.a); m.step(0x660a, 19);
  regs.a = 0x02;               m.step(0x660c, 7);
  mem.write8((regs.ix + 2) & 0xffff, regs.a);    m.step(0x660f, 19);
  mem.write8((regs.ix - 0x16) & 0xffff, regs.a); m.step(0x6612, 19);
  mem.write8((regs.ix - 0x2e) & 0xffff, regs.a); m.step(0x6615, 19);
  mem.write8(0x8930, regs.a);   m.step(0x6618, 13);
  mem.write8(0x892e, regs.a);   m.step(0x661b, 13);
  regs.iy = 0x82bc;             m.step(0x661f, 14);
  regs.de = 0x0000;            m.step(0x6622, 10);
  regs.b = 0x0a;               m.step(0x6624, 7);
  for (;;) {                   // first pass: (iy) vs (iy-0x20), stepping iy by -0x20
    regs.a = mem.read8((regs.iy + 0) & 0xffff);    m.step(0x6627, 19);
    regs.cp(mem.read8((regs.iy - 0x20) & 0xffff)); m.step(0x662a, 19);
    if (regs.fNZ) throw new Error("loc_6566: mirror-bank tamper trap 0x5284 (data) unreachable with a valid ROM"); // cf. loc_3278
    m.step(0x662d, 10);
    regs.add(regs.e);          m.step(0x662e, 4);
    regs.e = regs.a;           m.step(0x662f, 4);
    if (regs.fC) {
      m.step(0x6631, 7);
      regs.d = regs.inc8(regs.d); m.step(0x6632, 4);
    } else {
      m.step(0x6632, 12);
    }
    regs.a = regs.iy & 0xff;   m.step(0x6634, 8);
    regs.sub(0x20);           m.step(0x6636, 7);
    regs.iy = (regs.iy & 0xff00) | regs.a; m.step(0x6638, 8);
    if (regs.fC) {
      m.step(0x663a, 7);
      regs.iy = (regs.iy & 0x00ff) | (regs.dec8((regs.iy >> 8) & 0xff) << 8); m.step(0x663c, 8);
    } else {
      m.step(0x663c, 12);
    }
    if (regs.djnz() !== 0) { m.step(0x6624, 13); continue; }
    m.step(0x663e, 8);
    break;
  }
  regs.b = 0x0a;               m.step(0x6640, 7);
  regs.a = 0x04;               m.step(0x6642, 7);
  regs.add((regs.iy >> 8) & 0xff); m.step(0x6644, 8);
  regs.iy = (regs.iy & 0x00ff) | (regs.a << 8); m.step(0x6646, 8);
  regs.exDeHl();               m.step(0x6647, 4);
  regs.e = regs.iy & 0xff;     m.step(0x6649, 8);
  regs.d = (regs.iy >> 8) & 0xff; m.step(0x664b, 8);
  regs.exDeHl();               m.step(0x664c, 4);
  for (;;) {                   // second pass: sum (hl) into DE, stepping hl by +0x20
    regs.a = mem.read8(regs.hl); m.step(0x664d, 7);
    regs.add(regs.e);          m.step(0x664e, 4);
    if (regs.fC) {
      m.step(0x6650, 7);
      regs.d = regs.inc8(regs.d); m.step(0x6651, 4);
    } else {
      m.step(0x6651, 12);
    }
    regs.e = regs.a;           m.step(0x6652, 4);
    regs.a = regs.l;           m.step(0x6653, 4);
    regs.add(0x20);           m.step(0x6655, 7);
    if (regs.fC) {
      m.step(0x6657, 7);
      regs.h = regs.inc8(regs.h); m.step(0x6658, 4);
    } else {
      m.step(0x6658, 12);
    }
    regs.l = regs.a;           m.step(0x6659, 4);
    if (regs.djnz() !== 0) { m.step(0x664c, 13); continue; }
    m.step(0x665b, 8);
    break;
  }
  regs.a = regs.e;             m.step(0x665c, 4);
  regs.cp(0x2a);              m.step(0x665e, 7);
  if (regs.fNZ) throw new Error("loc_6566: checksum tamper trap 0x6014 (mid-instruction data, operand of call@0x6013) unreachable with a valid ROM");
  m.step(0x6661, 10);
  regs.d = regs.dec8(regs.d);  m.step(0x6662, 4);
  if (regs.fNZ) throw new Error("loc_6566: checksum tamper trap 0x2005 (data fail-vector) unreachable with a valid ROM");
  m.step(0x6665, 10);
  return m.ret(10);           // 0x6665
}
