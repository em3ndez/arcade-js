// SPDX-License-Identifier: GPL-3.0-only

// loc_1ab2  (ROM 0x1ab2-0x1b42) -- record-insert into the sorted 10-entry / 3-byte table at 0x8a00
// (most-significant byte at +2). Picks the new record at 0x88a2 (player 0) or 0x88a5 (player 1, +3),
// scans for the slot where new >= entry (C counts 0x1e down by 3 = the 10 entries); no slot in 10
// tries -> ret, nothing moved. On a slot: stores rank+1 at 0x89fc, opens the slot with an lddr shift
// of the 0x8a1d block, writes the 3-byte record, then lddr-shifts two parallel side-tables (0x89e0
// and 0x8e1c), seeds a 0x01 marker, and paints the fresh tiles via rst 0x10 (loc_0010). Self-
// contained: every jr/jp stays inside the span; the only external call is the page-zero rst 0x10.
export function loc_1ab2(m) {
  const { regs, mem } = m;

  regs.bc = 0x001e;             m.step(0x1ab5, 10);
  regs.l = regs.b;              m.step(0x1ab6, 4);   // ld l,b -- L = 0 (rank counter)
  regs.de = 0x0003;             m.step(0x1ab9, 10);  // record stride
  regs.ix = 0x88a2;             m.step(0x1abd, 14);
  regs.a = mem.read8(0x880d);   m.step(0x1ac0, 13);
  regs.rrca();                  m.step(0x1ac1, 4);   // carry <- 0x880d bit0 (player select)
  if (regs.fNC) {
    m.step(0x1ac5, 12);         // player 0 -> ix stays 0x88a2
  } else {
    m.step(0x1ac3, 7);
    regs.addIx(regs.de);        m.step(0x1ac5, 15);  // player 1 -> ix = 0x88a5
  }
  regs.iy = 0x8a00;             m.step(0x1ac9, 14);

  // loc_1ac9: scan for the insertion slot (new record >= table entry, compared MSB-first from +2)
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x1acc, 19);
    regs.cp(mem.read8((regs.iy + 0x02) & 0xffff));  m.step(0x1acf, 19);
    if (regs.fNZ) {
      m.step(0x1adf, 12);
    } else {
      m.step(0x1ad1, 7);
      regs.a = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x1ad4, 19);
      regs.cp(mem.read8((regs.iy + 0x01) & 0xffff));  m.step(0x1ad7, 19);
      if (regs.fNZ) {
        m.step(0x1adf, 12);
      } else {
        m.step(0x1ad9, 7);
        regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x1adc, 19);
        regs.cp(mem.read8((regs.iy + 0x00) & 0xffff));  m.step(0x1adf, 19);
      }
    }
    // loc_1adf
    if (regs.fNC) {
      m.step(0x1aea, 12);       // new >= entry -> slot found
      break;
    }
    m.step(0x1ae1, 7);
    regs.addIy(regs.de);        m.step(0x1ae3, 15);  // advance to next entry
    regs.l = regs.inc8(regs.l); m.step(0x1ae4, 4);
    regs.c = regs.dec8(regs.c); m.step(0x1ae5, 4);
    regs.c = regs.dec8(regs.c); m.step(0x1ae6, 4);
    regs.c = regs.dec8(regs.c); m.step(0x1ae7, 4);   // sets Z when the 10th entry is passed
    if (regs.fZ) return m.ret(11); // table exhausted -> ret, nothing moved
    m.step(0x1ae8, 5);
    m.step(0x1ac9, 12);         // jr 0x1ac9
  }

  // loc_1aea: slot found at rank L; open it and write the record
  regs.a = regs.l;              m.step(0x1aeb, 4);
  regs.a = regs.inc8(regs.a);   m.step(0x1aec, 4);
  mem.write8(0x89fc, regs.a);   m.step(0x1aef, 13);  // rank+1
  regs.a = regs.dec8(regs.a);   m.step(0x1af0, 4);
  m.push16(regs.bc);            m.step(0x1af1, 11);
  regs.hl = 0x8a1d;             m.step(0x1af4, 10);
  regs.de = 0x8a20;             m.step(0x1af7, 10);
  m.lddrAt(0x1af7, 0x1af9);     // shift the table down 3 to open the slot (BC bytes)
  regs.l = regs.a;              m.step(0x1afa, 4);
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x1afd, 19);
  mem.write8((regs.iy + 0x00) & 0xffff, regs.a);  m.step(0x1b00, 19);
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x1b03, 19);
  mem.write8((regs.iy + 0x01) & 0xffff, regs.a);  m.step(0x1b06, 19);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x1b09, 19);
  mem.write8((regs.iy + 0x02) & 0xffff, regs.a);  m.step(0x1b0c, 19);
  regs.bc = m.pop16();          m.step(0x1b0d, 10);
  m.push16(regs.bc);            m.step(0x1b0e, 11);
  regs.ix = 0x8a30;             m.step(0x1b12, 14);
  regs.hl = 0x89e1;             m.step(0x1b15, 10);
  regs.a = mem.read8(0x880d);   m.step(0x1b18, 13);
  regs.and(regs.a);             m.step(0x1b19, 4);
  if (regs.fZ) {
    m.step(0x1b20, 12);         // player 0
  } else {
    m.step(0x1b1b, 7);
    regs.ix = 0x8a33;           m.step(0x1b1f, 14);  // player 1 side-table
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1b20, 6); // inc hl
  }
  mem.write8(regs.hl, 0x01);    m.step(0x1b22, 10);
  regs.l = 0xdd;                m.step(0x1b24, 7);
  regs.de = 0x89e0;             m.step(0x1b27, 10);
  m.lddrAt(0x1b27, 0x1b29);     // shift the 0x89e0 side-table (BC bytes)
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x1b2c, 19);
  mem.write8(regs.de, regs.a);  m.step(0x1b2d, 7);
  regs.de = (regs.de - 1) & 0xffff; m.step(0x1b2e, 6); // dec de
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x1b31, 19);
  mem.write8(regs.de, regs.a);  m.step(0x1b32, 7);
  regs.bc = m.pop16();          m.step(0x1b33, 10);
  regs.hl = 0x8e1c;             m.step(0x1b36, 10);
  regs.de = 0x8e1f;             m.step(0x1b39, 10);
  m.lddrAt(0x1b39, 0x1b3b);     // shift the 0x8e1c tile side-table (BC bytes)
  regs.exDeHl();                m.step(0x1b3c, 4);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x1b3d, 6); // dec hl
  regs.a = 0x10;                m.step(0x1b3f, 7);
  regs.b = 0x03;                m.step(0x1b41, 7);
  m.push16(0x1b42); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 -- paint the new-record tiles
  return m.ret(10); // 1b42  ret
}
