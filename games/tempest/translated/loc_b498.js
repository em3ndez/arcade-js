// SPDX-License-Identifier: GPL-3.0-only
// loc_b498  (ROM 0xb498-0xb569) -- builds vector display list at ($74),y for up to 0x12 objects,
// reading tables $0243/$0203/$038a/$037a/$036a/$035a indexed by $37; loops until $56 or $37 goes
// negative, flushes via $df5f, then conditionally sets $53 and tail-jumps to $df6a.
export function loc_b498(m) {
  const { regs, mem } = m;
  regs.y = 0x0c; regs.setNZ(regs.y); m.step(0xb49a, 2);
  mem.write8(0x9e, regs.y); m.step(0xb49c, 3);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xb49e, 2);
  m.push16(0xb4a0); m.step(0xb4a1, 6); m.call(0xdf4c);
  regs.x = 0x66; regs.setNZ(regs.x); m.step(0xb4a3, 2);
  m.push16(0xb4a5); m.step(0xb4a6, 6); m.call(0xc765);
  regs.a = 0x12; regs.setNZ(regs.a); m.step(0xb4a8, 2);
  mem.write8(0x56, regs.a); m.step(0xb4aa, 3);
  regs.x = 0x3f; regs.setNZ(regs.x); m.step(0xb4ac, 2);
  mem.write8(0x37, regs.x); m.step(0xb4ae, 3);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb4b0, 2);

  // main loop head b4b0
  while (true) {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xb4b2, 3);
    regs.a = mem.read8((0x0243 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb4b5, 4);
    if (regs.fNZ) {
      m.step(0xb4ba, 3);
      regs.cmp(0x50); m.step(0xb4bc, 2);
      if (regs.fNC) {
        m.step(0xb4c0, 3);
      } else {
        m.step(0xb4be, 2);
        mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xb4c0, 5);
      }
      m.push8(regs.a); m.step(0xb4c1, 3);
      regs.and(0x3f); m.step(0xb4c3, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb4c5, 6);
      regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xb4c6, 4);
      regs.a = regs.rol(regs.a); m.step(0xb4c7, 2);
      regs.a = regs.rol(regs.a); m.step(0xb4c8, 2);
      regs.a = regs.rol(regs.a); m.step(0xb4c9, 2);
      regs.and(0x03); m.step(0xb4cb, 2);
      regs.clc(); m.step(0xb4cc, 2);
      regs.adc(0x01); m.step(0xb4ce, 2);
      regs.ora(0x70); m.step(0xb4d0, 2);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb4d1, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb4d3, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb4d4, 2);
      regs.a = mem.read8((0x0203 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb4d7, 4);// b4d4 lda $0203,x
      regs.x = regs.a; regs.setNZ(regs.x); m.step(0xb4d8, 2);
      regs.a = mem.read8((0x038a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb4db, 4);// b4d8 lda $038a,x
      regs.sec(); m.step(0xb4dc, 2);
      regs.sbc(mem.read8(0x68)); m.step(0xb4de, 3);
      mem.write8(0x63, regs.a); m.step(0xb4e0, 3);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb4e2, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb4e3, 2);
      regs.a = mem.read8((0x037a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb4e6, 4);// b4e3 lda $037a,x
      regs.sbc(mem.read8(0x69)); m.step(0xb4e8, 3);
      mem.write8(0x64, regs.a); m.step(0xb4ea, 3);
      regs.and(0x1f); m.step(0xb4ec, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb4ee, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb4ef, 2);
      regs.a = mem.read8((0x036a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb4f2, 4);// b4ef lda $036a,x
      mem.write8(0x61, regs.a); m.step(0xb4f4, 3);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb4f6, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb4f7, 2);
      regs.a = mem.read8((0x035a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb4fa, 4);// b4f7 lda $035a,x
      mem.write8(0x62, regs.a); m.step(0xb4fc, 3);
      regs.and(0x1f); m.step(0xb4fe, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb500, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb501, 2);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb503, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb505, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb506, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb508, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb509, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb50b, 6);
      regs.a = 0xa0; regs.setNZ(regs.a); m.step(0xb50d, 2);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb50e, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb510, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb511, 2);
      regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xb513, 3);
      regs.eor(0xff); m.step(0xb515, 2);
      regs.clc(); m.step(0xb516, 2);
      regs.adc(0x01); m.step(0xb518, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb51a, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb51b, 2);
      regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xb51d, 3);
      regs.eor(0xff); m.step(0xb51f, 2);
      regs.adc(0x00); m.step(0xb521, 2);
      regs.and(0x1f); m.step(0xb523, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb525, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb526, 2);
      regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xb528, 3);
      regs.eor(0xff); m.step(0xb52a, 2);
      regs.clc(); m.step(0xb52b, 2);
      regs.adc(0x01); m.step(0xb52d, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb52f, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb530, 2);
      regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xb532, 3);
      regs.eor(0xff); m.step(0xb534, 2);
      regs.adc(0x00); m.step(0xb536, 2);
      regs.and(0x1f); m.step(0xb538, 2);
      mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb53a, 6);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb53b, 2);
      regs.cpy(0xf0); m.step(0xb53d, 2);
      if (regs.fNC) {
        m.step(0xb545, 3);
      } else {
        m.step(0xb53f, 2);
        regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0xb540, 2);
        m.push16(0xb542); m.step(0xb543, 6); m.call(0xdf5f);
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb545, 2);
      }
      mem.write8(0x56, regs.dec8(mem.read8(0x56))); m.step(0xb547, 5);
      if (regs.fN) { m.step(0xb550, 3); break; }
      m.step(0xb549, 2);
    } else {
      m.step(0xb4b7, 2);
      m.step(0xb549, 3);
    }
    // shared continuation b549
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xb54b, 5);
    if (regs.fN) { m.step(0xb550, 3); break; }
    m.step(0xb54d, 2);
    m.step(0xb4b0, 3);
  }

  // tail b550
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xb551, 2);
  if (regs.fZ) {
    m.step(0xb557, 3);
  } else {
    m.step(0xb553, 2);
    regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0xb554, 2);
    m.push16(0xb556); m.step(0xb557, 6); m.call(0xdf5f);
  }
  regs.a = mem.read8(0xb5); regs.setNZ(regs.a); m.step(0xb559, 3);
  if (regs.fZ) {
    m.step(0xb565, 3);
  } else {
    m.step(0xb55b, 2);
    regs.a = mem.read8(0x46); regs.setNZ(regs.a); m.step(0xb55d, 3);
    regs.cmp(0x0a); m.step(0xb55f, 2);
    if (regs.fNC) {
      m.step(0xb565, 3);
    } else {
      m.step(0xb561, 2);
      regs.a = 0x7a; regs.setNZ(regs.a); m.step(0xb563, 2);
      mem.write8(0x53, regs.a); m.step(0xb565, 3);
    }
  }
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xb567, 2);
  m.step(0xdf6a, 3); return m.call(0xdf6a);
}
