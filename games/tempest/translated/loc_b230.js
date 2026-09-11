// SPDX-License-Identifier: GPL-3.0-only
// loc_b230  (ROM 0xb230-0xb2bd) -- draws the frame: paired b2be(setup)/subsystem/b2fe(teardown) jsr sequence,
// a conditional 0x28-entry adc-sum loop into $011b, then latches $cec2/$cec3 to $2000/$2001.
export function loc_b230(m) {
  const { regs, mem } = m;
  regs.a = 0x07; regs.setNZ(regs.a); m.step(0xb232, 2);
  m.push16(0xb234); m.step(0xb235, 6); m.call(0xb2be);
  m.push16(0xb237); m.step(0xb238, 6); m.call(0xb586);
  regs.a = 0x07; regs.setNZ(regs.a); m.step(0xb23a, 2);
  m.push16(0xb23c); m.step(0xb23d, 6); m.call(0xb2fe);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xb23f, 2);
  m.push16(0xb241); m.step(0xb242, 6); m.call(0xb2be);
  m.push16(0xb244); m.step(0xb245, 6); m.call(0xb75b);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xb247, 2);
  m.push16(0xb249); m.step(0xb24a, 6); m.call(0xb2fe);
  regs.a = 0x03; regs.setNZ(regs.a); m.step(0xb24c, 2);
  m.push16(0xb24e); m.step(0xb24f, 6); m.call(0xb2be);
  m.push16(0xb251); m.step(0xb252, 6); m.call(0xb5ad);
  regs.a = 0x03; regs.setNZ(regs.a); m.step(0xb254, 2);
  m.push16(0xb256); m.step(0xb257, 6); m.call(0xb2fe);
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0xb259, 2);
  m.push16(0xb25b); m.step(0xb25c, 6); m.call(0xb2be);
  m.push16(0xb25e); m.step(0xb25f, 6); m.call(0xb79a);
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0xb261, 2);
  m.push16(0xb263); m.step(0xb264, 6); m.call(0xb2fe);
  regs.a = 0x05; regs.setNZ(regs.a); m.step(0xb266, 2);
  m.push16(0xb268); m.step(0xb269, 6); m.call(0xb2be);
  m.push16(0xb26b); m.step(0xb26c, 6); m.call(0xb498);
  regs.a = 0x05; regs.setNZ(regs.a); m.step(0xb26e, 2);
  m.push16(0xb270); m.step(0xb271, 6); m.call(0xb2fe);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb273, 2);
  m.push16(0xb275); m.step(0xb276, 6); m.call(0xb2be);
  m.push16(0xb278); m.step(0xb279, 6); m.call(0xa8b4);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xb27b, 3);
  if (regs.fN) {
    m.step(0xb28a, 3);
  } else {
    m.step(0xb27d, 2);
    regs.a = 0xf2; regs.setNZ(regs.a); m.step(0xb27f, 2);
    regs.clc(); m.step(0xb280, 2);
    regs.y = 0x27; regs.setNZ(regs.y); m.step(0xb282, 2);
    while (true) {
      const ptr = mem.read8(0xb6) | (mem.read8(0xb7) << 8);
      regs.adc(mem.read8((ptr + regs.y) & 0xffff)); m.step(0xb284, 5);
      regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0xb285, 2);
      if (!regs.fN) { m.step(0xb282, 3); continue; }
      m.step(0xb287, 2); break;
    }
    mem.write8(0x011b, regs.a); m.step(0xb28a, 4);
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb28c, 2);
  m.push16(0xb28e); m.step(0xb28f, 6); m.call(0xb2fe);
  m.push16(0xb291); m.step(0xb292, 6); m.call(0xb367);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xb294, 2);
  m.push16(0xb296); m.step(0xb297, 6); m.call(0xb2be);
  m.push16(0xb299); m.step(0xb29a, 6); m.call(0xc5c2);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xb29c, 2);
  m.push16(0xb29e); m.step(0xb29f, 6); m.call(0xb2fe);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xb2a1, 2);
  m.push16(0xb2a3); m.step(0xb2a4, 6); m.call(0xb2be);
  m.push16(0xb2a6); m.step(0xb2a7, 6); m.call(0xc54d);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xb2a9, 2);
  m.push16(0xb2ab); m.step(0xb2ac, 6); m.call(0xb2fe);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb2ae, 2);
  mem.write8(0x0114, regs.a); m.step(0xb2b1, 4);
  regs.a = mem.read8(0xcec2); regs.setNZ(regs.a); m.step(0xb2b4, 4);
  mem.write8(0x2000, regs.a); m.step(0xb2b7, 4);
  regs.a = mem.read8(0xcec3); regs.setNZ(regs.a); m.step(0xb2ba, 4);
  mem.write8(0x2001, regs.a); m.step(0xb2bd, 4);
  return m.ret(6);
}
