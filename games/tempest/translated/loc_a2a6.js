// SPDX-License-Identifier: GPL-3.0-only
// loc_a2a6  (ROM 0xa2a6-0xa303) -- returns if $0201 negative. Scans x=6..0: for an active slot
// ($02df,x>=0x30, $028a,x bit6 set) counts down its timer $02a6,x; when it underflows and $0283,x
// bit7 clear and RNG $60ca >= table[$a304+$a6], find a free $02db,y slot ($011a..0), copy the
// spawn fields, seed timer $0119, jsr ccbd, inc $a6.
export function loc_a2a6(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0xa2a9, 4);
  if (regs.fN) { m.step(0xa303, 3); return m.ret(6); }
  m.step(0xa2ab, 2);
  regs.x = 0x06; regs.setNZ(regs.x); m.step(0xa2ad, 2);
  do {
    regs.a = mem.read8((0x02df + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa2b0, 4);
    let skip = false;
    if (regs.fZ) { m.step(0xa300, 3); skip = true; }
    if (!skip) {
      m.step(0xa2b2, 2);
      regs.cmp(0x30); m.step(0xa2b4, 2);
      if (regs.fNC) { m.step(0xa300, 3); skip = true; }
    }
    if (!skip) {
      m.step(0xa2b6, 2);
      regs.a = mem.read8((0x028a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa2b9, 4);
      regs.and(0x40); m.step(0xa2bb, 2);
      if (regs.fZ) { m.step(0xa300, 3); skip = true; }
    }
    if (!skip) {
      m.step(0xa2bd, 2);
      mem.write8((0x02a6 + regs.x) & 0xffff, regs.dec8(mem.read8((0x02a6 + regs.x) & 0xffff))); m.step(0xa2c0, 7);
      if (!regs.fN) { m.step(0xa300, 3); skip = true; }
    }
    if (!skip) {
      m.step(0xa2c2, 2);
      mem.write8((0x02a6 + regs.x) & 0xffff, regs.inc8(mem.read8((0x02a6 + regs.x) & 0xffff))); m.step(0xa2c5, 7);
      regs.a = mem.read8((0x0283 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa2c8, 4);
      regs.and(0x80); m.step(0xa2ca, 2);
      if (regs.fNZ) { m.step(0xa300, 3); skip = true; }
    }
    if (!skip) {
      m.step(0xa2cc, 2);
      regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xa2cf, 4);
      regs.y = mem.read8(0xa6); regs.setNZ(regs.y); m.step(0xa2d1, 3);
      regs.cmp(mem.read8((0xa304 + regs.y) & 0xffff)); m.step(0xa2d4, 4);
      if (regs.fNC) { m.step(0xa300, 3); skip = true; }
    }
    if (!skip) {
      m.step(0xa2d6, 2);
      regs.y = mem.read8(0x011a); regs.setNZ(regs.y); m.step(0xa2d9, 4);
      do {
        regs.a = mem.read8((0x02db + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa2dc, 4);
        if (regs.fNZ) {
          m.step(0xa2fd, 3);
        } else {
          m.step(0xa2de, 2);
          regs.a = mem.read8((0x02df + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa2e1, 4);
          mem.write8((0x02db + regs.y) & 0xffff, regs.a); m.step(0xa2e4, 5);
          regs.a = mem.read8((0x02b9 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa2e7, 4);
          mem.write8((0x02b5 + regs.y) & 0xffff, regs.a); m.step(0xa2ea, 5);
          regs.a = mem.read8((0x02cc + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa2ed, 4);
          mem.write8((0x02c8 + regs.y) & 0xffff, regs.a); m.step(0xa2f0, 5);
          regs.a = mem.read8(0x0119); regs.setNZ(regs.a); m.step(0xa2f3, 4);
          mem.write8((0x02a6 + regs.x) & 0xffff, regs.a); m.step(0xa2f6, 5);
          m.push16(0xa2f8); m.step(0xa2f9, 6); m.call(0xccbd);
          mem.write8(0xa6, regs.inc8(mem.read8(0xa6))); m.step(0xa2fb, 5);
          regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa2fd, 2);
        }
        regs.y = regs.dec8(regs.y); m.step(0xa2fe, 2);
        if (!regs.fN) { m.step(0xa2d9, 3); continue; }
        m.step(0xa300, 2); break;
      } while (true);
    }
    regs.x = regs.dec8(regs.x); m.step(0xa301, 2);
    if (!regs.fN) { m.step(0xa2ad, 3); continue; }
    m.step(0xa303, 2); break;
  } while (true);
  return m.ret(6);
}
