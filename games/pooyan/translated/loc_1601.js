// SPDX-License-Identifier: GPL-3.0-only

// loc_1601  (ROM 0x1601-0x1691) -- gameplay-state idx0 handler (round init). Runs 0x02c9 (bails
// via `ret nz` if it reported not-done), re-seats the scroll pointer (0x02e3), zero-fills work RAM
// (0x19bc), blanks two tile spans via rst 0x10, and clears (0x8f16/0x8f17). When (0x880e)==0 or the
// once-per-round latch (0x89e3) is already set it skips the first-entry block; otherwise it sets the
// latch, derives a value from (0x880f)/(0x880d), enqueues a display command (rst 0x38), and runs
// loc_075d. Common tail: (0x8808)=A, bump (0x880a), copy a 0x3f-byte block (source 0x8940 or 0x8980
// per (0x880d)) into 0x8900, optional (0x8931) fixup, then (unless (0x8906)!=0) copy the 0x16ae table
// (0xff-terminated) into 0x89f0. rst 0x10=loc_0010 fill; rst 0x38=loc_0038 display enqueue.
export function loc_1601(m) {
  const { regs, mem } = m;

  m.push16(0x1604);
  m.step(0x02c9, 17);              // 1601  call 0x02c9 (pattern A -> 0x1604)
  m.call(0x02c9);
  if (regs.fNZ) { m.ret(11); return; } // 1604  ret nz -- 0x02c9 not done
  m.step(0x1605, 5);              // ret nz not taken

  m.push16(0x1608);
  m.step(0x02e3, 17);             // 1605  call 0x02e3 (pattern A -> 0x1608)
  m.call(0x02e3);
  m.push16(0x160b);
  m.step(0x19bc, 17);             // 1608  call 0x19bc (pattern A -> 0x160b)
  m.call(0x19bc);

  regs.xor(regs.a);              m.step(0x160c, 4);
  mem.write8(0x8d21, regs.a);   m.step(0x160f, 13);
  regs.hl = 0x8d23;             m.step(0x1612, 10);
  regs.b = 0xc0;                m.step(0x1614, 7);
  m.push16(0x1615);
  m.step(0x0010, 11);           // 1614  rst 0x10 (blank 0xc0 tiles at 0x8d23)
  m.call(0x0010);

  regs.hl = 0x8e21;             m.step(0x1618, 10);
  regs.b = 0x0c;                m.step(0x161a, 7);
  m.push16(0x161b);
  m.step(0x0010, 11);           // 161a  rst 0x10 (blank 0x0c tiles at 0x8e21)
  m.call(0x0010);

  mem.write8(0x8f16, regs.a);   m.step(0x161e, 13);
  mem.write8(0x8f17, regs.a);   m.step(0x1621, 13);
  regs.a = mem.read8(0x880e);   m.step(0x1624, 13);
  regs.and(regs.a);             m.step(0x1625, 4);
  regs.a = 0x02;                m.step(0x1627, 7);

  if (regs.fZ) {
    m.step(0x1653, 12);         // 1627  jr z,0x1653 taken -- (0x880e)==0, skip first-entry block
  } else {
    m.step(0x1629, 7);          // jr z not taken
    regs.a = mem.read8(0x89e3); m.step(0x162c, 13);
    regs.and(regs.a);           m.step(0x162d, 4);
    if (regs.fNZ) {
      m.step(0x1653, 12);       // 162d  jr nz,0x1653 taken -- latch already set
    } else {
      m.step(0x162f, 7);        // jr nz not taken
      regs.a = regs.inc8(regs.a); m.step(0x1630, 4);   // inc a -> 1
      mem.write8(0x89e3, regs.a); m.step(0x1633, 13);  // set once-per-round latch
      regs.a = mem.read8(0x880f); m.step(0x1636, 13);
      regs.and(regs.a);           m.step(0x1637, 4);    // flags from (0x880f); A reloaded next
      regs.a = mem.read8(0x880d); m.step(0x163a, 13);
      if (regs.fNZ) {
        m.step(0x1642, 12);       // 163a  jr nz,0x1642 taken
        regs.a = regs.dec8(regs.a); m.step(0x1643, 4); // 1642  dec a
      } else {
        m.step(0x163c, 7);        // jr nz not taken
        regs.a = regs.dec8(regs.a); m.step(0x163d, 4); // 163c  dec a
        mem.write8(0x881f, regs.a); m.step(0x1640, 13);
        m.step(0x1643, 12);       // 1640  jr 0x1643
      }
      regs.de = 0x0602;           m.step(0x1646, 10);
      regs.and(regs.a);           m.step(0x1647, 4);
      if (regs.fNZ) {
        m.step(0x164a, 12);       // 1647  jr nz,0x164a taken
      } else {
        m.step(0x1649, 7);        // jr nz not taken
        regs.e = regs.inc8(regs.e); m.step(0x164a, 4); // inc e -> DE=0x0603
      }
      m.push16(0x164b);
      m.step(0x0038, 11);         // 164a  rst 0x38 (loc_0038 display enqueue, DE)
      m.call(0x0038);
      regs.bc = 0x0779;           m.step(0x164e, 10);
      m.push16(0x1651);
      m.step(0x075d, 17);         // 164e  call 0x075d (pattern A -> 0x1651)
      m.call(0x075d);
      regs.a = 0x80;              m.step(0x1653, 7); // 1651  ld a,0x80
    }
  }

  // loc_1653: common tail
  mem.write8(0x8808, regs.a);   m.step(0x1656, 13);
  regs.hl = 0x880a;             m.step(0x1659, 10);
  regs.incMem8(mem, regs.hl);   m.step(0x165a, 11); // inc (hl)
  regs.a = mem.read8(0x880d);   m.step(0x165d, 13);
  regs.hl = 0x8940;             m.step(0x1660, 10);
  regs.de = 0x8900;             m.step(0x1663, 10);
  regs.bc = 0x003f;             m.step(0x1666, 10);
  regs.and(regs.a);             m.step(0x1667, 4);
  if (regs.fZ) {
    m.step(0x166c, 12);         // 1667  jr z,0x166c taken -- source stays 0x8940
  } else {
    m.step(0x1669, 7);          // jr z not taken
    regs.hl = 0x8980;           m.step(0x166c, 10); // 1669  ld hl,0x8980
  }
  m.ldirAt(0x166c, 0x166e);     // 166c  ldir -- copy 0x3f bytes -> 0x8900

  regs.a = mem.read8(0x8903);   m.step(0x1671, 13);
  regs.and(regs.a);             m.step(0x1672, 4);
  if (regs.fZ) {
    m.step(0x1679, 12);         // 1672  jr z,0x1679 taken
  } else {
    m.step(0x1674, 7);          // jr z not taken
    regs.sub(0x02);             m.step(0x1676, 7);   // sub 0x02
    mem.write8(0x8931, regs.a); m.step(0x1679, 13);
  }

  regs.a = mem.read8(0x8906);   m.step(0x167c, 13);
  regs.and(regs.a);             m.step(0x167d, 4);
  if (regs.fNZ) { m.ret(11); return; } // 167d  ret nz
  m.step(0x167e, 5);            // ret nz not taken

  mem.write8(0x8905, regs.a);   m.step(0x1681, 13); // A==0 here
  mem.write8(0x890a, regs.a);   m.step(0x1684, 13);
  regs.de = 0x16ae;             m.step(0x1687, 10);
  regs.hl = 0x89f0;             m.step(0x168a, 10);

  for (;;) { // loc_168a: copy 0x16ae table until 0xff terminator
    regs.a = mem.read8(regs.de); m.step(0x168b, 7);   // ld a,(de)
    regs.cp(0xff);               m.step(0x168d, 7);
    if (regs.fZ) { m.ret(11); return; } // 168d  ret z -- terminator
    m.step(0x168e, 5);           // ret z not taken
    mem.write8(regs.hl, regs.a); m.step(0x168f, 7);   // ld (hl),a
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1690, 6); // inc de
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1691, 6); // inc hl
    m.step(0x168a, 12);          // 1691  jr 0x168a
  }
}
