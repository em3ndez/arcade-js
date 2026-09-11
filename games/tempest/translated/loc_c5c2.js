// SPDX-License-Identifier: GPL-3.0-only
// loc_c5c2  (ROM 0xc5c2-0xc668) -- per-frame builds up to 16 enemy display-list entries. Guards on $0110/
// $5b/$5f, saves $74/$75, then loops slot $37..0 (via $38): copies a 4-byte header from $c669, then per
// slot either the midpoint pair (jsr $c66d), a plain 12-byte block, or a sign-extended block (+jsr $c6c7);
// $0114 forces the pair path. Advances $a9 (display ptr), doubles $039a[slot], jmp $df5f to finish.
export function loc_c5c2(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0110); regs.setNZ(regs.a); m.step(0xc5c5, 4);
  if (regs.fNZ) { m.step(0xc5c7, 2); return m.ret(6); }
  m.step(0xc5c8, 3);
  regs.a = mem.read8(0x5b); regs.setNZ(regs.a); m.step(0xc5ca, 3);
  if (regs.fZ) {
    m.step(0xc5cc, 2);
    regs.a = mem.read8(0x5f); regs.setNZ(regs.a); m.step(0xc5ce, 3);
    regs.cmp(0xf0); m.step(0xc5d0, 2);
    if (!regs.fNC) { m.step(0xc5d2, 2); return m.ret(6); }
    m.step(0xc5d3, 3);
  } else {
    m.step(0xc5d3, 3);
  }
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xc5d5, 2);
  m.push16(0xc5d7); m.step(0xc5d8, 6); m.call(0xdf6a);
  regs.a = mem.read8(0x74); regs.setNZ(regs.a); m.step(0xc5da, 3);
  m.push8(regs.a); m.step(0xc5db, 3);
  regs.a = mem.read8(0x75); regs.setNZ(regs.a); m.step(0xc5dd, 3);
  m.push8(regs.a); m.step(0xc5de, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc5e0, 2);
  mem.write8(0x38, regs.a); m.step(0xc5e2, 3);
  mem.write8(0xa9, regs.a); m.step(0xc5e4, 3);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xc5e6, 2);
  regs.a = mem.read8(0x0111); regs.setNZ(regs.a); m.step(0xc5e9, 4);
  if (regs.fNZ) {
    m.step(0xc5eb, 2);
    regs.x = regs.dec8(regs.x); m.step(0xc5ec, 2);
  } else {
    m.step(0xc5ec, 3);
  }
  mem.write8(0x37, regs.x); m.step(0xc5ee, 3);
  // outer loop c5ee..c65b (dec 0x37 / bpl 0xc5ee)
  while (true) {
    regs.x = 0x03; regs.setNZ(regs.x); m.step(0xc5f0, 2);
    regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xc5f2, 3);
    // inner header-copy loop c5f2..c5f9
    while (true) {
      regs.a = mem.read8((0xc669 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc5f5, 4);
      { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc5f7, 6); }
      regs.y = regs.inc8(regs.y); m.step(0xc5f8, 2);
      regs.x = regs.dec8(regs.x); m.step(0xc5f9, 2);
      if (regs.fPl) { m.step(0xc5f2, 3); } else { m.step(0xc5fb, 2); break; }
    }
    mem.write8(0xa9, regs.y); m.step(0xc5fd, 3);
    regs.a = mem.read8(0x0114); regs.setNZ(regs.a); m.step(0xc600, 4);
    if (regs.fNZ) {
      m.step(0xc64c, 3);
      m.push16(0xc64e); m.step(0xc64f, 6); m.call(0xc66d);
      m.push16(0xc651); m.step(0xc652, 6); m.call(0xc6c7);
    } else {
      m.step(0xc602, 2);
      regs.x = mem.read8(0x38); regs.setNZ(regs.x); m.step(0xc604, 3);
      regs.a = mem.read8((0x039a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc607, 4);
      if (regs.fN) {
        m.step(0xc61a, 3);
        regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xc61c, 3);
        { const ptr = mem.read16(0x00aa); const ea = (ptr + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc61e, (ptr & 0xff00) !== (ea & 0xff00) ? 6 : 5); }
        { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc620, 6); }
        mem.write8(0x6c, regs.a); m.step(0xc622, 3);
        regs.y = regs.inc8(regs.y); m.step(0xc623, 2);
        { const ptr = mem.read16(0x00aa); const ea = (ptr + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc625, (ptr & 0xff00) !== (ea & 0xff00) ? 6 : 5); }
        { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc627, 6); }
        regs.cmp(0x10); m.step(0xc629, 2);
        if (regs.fNC) { m.step(0xc62d, 3); } else { m.step(0xc62b, 2); regs.ora(0xe0); m.step(0xc62d, 2); }
        mem.write8(0x6d, regs.a); m.step(0xc62f, 3);
        regs.y = regs.inc8(regs.y); m.step(0xc630, 2);
        { const ptr = mem.read16(0x00aa); const ea = (ptr + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc632, (ptr & 0xff00) !== (ea & 0xff00) ? 6 : 5); }
        { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc634, 6); }
        mem.write8(0x6a, regs.a); m.step(0xc636, 3);
        regs.y = regs.inc8(regs.y); m.step(0xc637, 2);
        { const ptr = mem.read16(0x00aa); const ea = (ptr + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc639, (ptr & 0xff00) !== (ea & 0xff00) ? 6 : 5); }
        { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc63b, 6); }
        regs.cmp(0x10); m.step(0xc63d, 2);
        if (regs.fNC) { m.step(0xc641, 3); } else { m.step(0xc63f, 2); regs.ora(0xe0); m.step(0xc641, 2); }
        mem.write8(0x6b, regs.a); m.step(0xc643, 3);
        regs.y = regs.inc8(regs.y); m.step(0xc644, 2);
        mem.write8(0xa9, regs.y); m.step(0xc646, 3);
        m.push16(0xc648); m.step(0xc649, 6); m.call(0xc6c7);
      } else {
        m.step(0xc609, 2);
        regs.x = 0x0b; regs.setNZ(regs.x); m.step(0xc60b, 2);
        regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xc60d, 3);
        // 12-byte copy loop c60d..c613
        while (true) {
          { const ptr = mem.read16(0x00aa); const ea = (ptr + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc60f, (ptr & 0xff00) !== (ea & 0xff00) ? 6 : 5); }
          { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc611, 6); }
          regs.y = regs.inc8(regs.y); m.step(0xc612, 2);
          regs.x = regs.dec8(regs.x); m.step(0xc613, 2);
          if (regs.fPl) { m.step(0xc60d, 3); } else { m.step(0xc615, 2); break; }
        }
        mem.write8(0xa9, regs.y); m.step(0xc617, 3);
        regs.clv(); m.step(0xc618, 2);
        m.step(0xc649, 3);
      }
      regs.clv(); m.step(0xc64a, 2);
      m.step(0xc652, 3);
    }
    regs.x = mem.read8(0x38); regs.setNZ(regs.x); m.step(0xc654, 3);
    mem.write8((0x039a + regs.x) & 0xffff, regs.asl(mem.read8((0x039a + regs.x) & 0xffff))); m.step(0xc657, 7);
    mem.write8(0x38, regs.inc8(mem.read8(0x38))); m.step(0xc659, 5);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xc65b, 5);
    if (regs.fPl) { m.step(0xc5ee, 3); } else { m.step(0xc65d, 2); break; }
  }
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc65e, 4);
  mem.write8(0xab, regs.a); m.step(0xc660, 3);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc661, 4);
  mem.write8(0xaa, regs.a); m.step(0xc663, 3);
  regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xc665, 3);
  regs.y = regs.dec8(regs.y); m.step(0xc666, 2);
  m.step(0xdf5f, 3); return m.call(0xdf5f);
}
