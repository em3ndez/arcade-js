// SPDX-License-Identifier: GPL-3.0-only
// loc_c473  (ROM 0xc473-0xc4e0) -- 16-pass loop ($37: 0x0f..0x00): per pass jsr $c098 then clamps two
// signed pairs ($61/$62 and $63/$64) into [0xfc..0x03], writing $031a/$032a and $033a/$034a indexed by
// $38, counting clamps in $59; returns $59 in A. Two forward if/else chains per half, one backward loop.
export function loc_c473(m) {
  const { regs, mem } = m;
  mem.write8(0x57, regs.a); m.step(0xc475, 3);
  mem.write8(0x38, regs.x); m.step(0xc477, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc479, 2);
  mem.write8(0x59, regs.a); m.step(0xc47b, 3);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xc47d, 2);
  mem.write8(0x37, regs.x); m.step(0xc47f, 3);
  for (;;) {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xc481, 3);
    regs.a = mem.read8((0x03ce + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc484, 4);
    mem.write8(0x56, regs.a); m.step(0xc486, 3);
    regs.a = mem.read8((0x03de + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc489, 4);
    mem.write8(0x58, regs.a); m.step(0xc48b, 3);
    m.push16(0xc48d); m.step(0xc48e, 6); m.call(0xc098);
    // ---- first half: clamp ($61=Y, $62=A) ----
    regs.x = mem.read8(0x38); regs.setNZ(regs.x); m.step(0xc490, 3);
    regs.y = mem.read8(0x61); regs.setNZ(regs.y); m.step(0xc492, 3);
    regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xc494, 3);
    if (regs.fN) {
      m.step(0xc4a3, 3);
      regs.cmp(0xfc); m.step(0xc4a5, 2);
      if (regs.fC) {
        m.step(0xc4ad, 3);
      } else {
        m.step(0xc4a7, 2);
        regs.y = 0x01; regs.setNZ(regs.y); m.step(0xc4a9, 2);
        regs.a = 0xfc; regs.setNZ(regs.a); m.step(0xc4ab, 2);
        mem.write8(0x59, regs.inc8(mem.read8(0x59))); m.step(0xc4ad, 5);
      }
    } else {
      m.step(0xc496, 2);
      regs.cmp(0x04); m.step(0xc498, 2);
      if (regs.fNC) {
        m.step(0xc4a0, 3);
      } else {
        m.step(0xc49a, 2);
        regs.y = 0xff; regs.setNZ(regs.y); m.step(0xc49c, 2);
        regs.a = 0x03; regs.setNZ(regs.a); m.step(0xc49e, 2);
        mem.write8(0x59, regs.inc8(mem.read8(0x59))); m.step(0xc4a0, 5);
      }
      regs.clv(); m.step(0xc4a1, 2);
      m.step(0xc4ad, 3);
    }
    mem.write8((0x031a + regs.x) & 0xffff, regs.a); m.step(0xc4b0, 5);
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0xc4b1, 2);
    mem.write8((0x032a + regs.x) & 0xffff, regs.a); m.step(0xc4b4, 5);
    // ---- second half: clamp ($63=Y, $64=A) ----
    regs.y = mem.read8(0x63); regs.setNZ(regs.y); m.step(0xc4b6, 3);
    regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xc4b8, 3);
    if (regs.fN) {
      m.step(0xc4c7, 3);
      regs.cmp(0xfc); m.step(0xc4c9, 2);
      if (regs.fC) {
        m.step(0xc4d1, 3);
      } else {
        m.step(0xc4cb, 2);
        regs.a = 0xfc; regs.setNZ(regs.a); m.step(0xc4cd, 2);
        regs.y = 0x01; regs.setNZ(regs.y); m.step(0xc4cf, 2);
        mem.write8(0x59, regs.inc8(mem.read8(0x59))); m.step(0xc4d1, 5);
      }
    } else {
      m.step(0xc4ba, 2);
      regs.cmp(0x04); m.step(0xc4bc, 2);
      if (regs.fNC) {
        m.step(0xc4c4, 3);
      } else {
        m.step(0xc4be, 2);
        regs.y = 0xff; regs.setNZ(regs.y); m.step(0xc4c0, 2);
        regs.a = 0x03; regs.setNZ(regs.a); m.step(0xc4c2, 2);
        mem.write8(0x59, regs.inc8(mem.read8(0x59))); m.step(0xc4c4, 5);
      }
      regs.clv(); m.step(0xc4c5, 2);
      m.step(0xc4d1, 3);
    }
    mem.write8((0x033a + regs.x) & 0xffff, regs.a); m.step(0xc4d4, 5);
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0xc4d5, 2);
    mem.write8((0x034a + regs.x) & 0xffff, regs.a); m.step(0xc4d8, 5);
    mem.write8(0x38, regs.dec8(mem.read8(0x38))); m.step(0xc4da, 5);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xc4dc, 5);
    if (regs.fPl) { m.step(0xc47f, 3); continue; }
    m.step(0xc4de, 2); break;
  }
  regs.a = mem.read8(0x59); regs.setNZ(regs.a); m.step(0xc4e0, 3);
  return m.ret(6);
}
