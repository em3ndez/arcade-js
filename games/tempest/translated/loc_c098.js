// SPDX-License-Identifier: GPL-3.0-only
// loc_c098  (ROM 0xc098-0xc16d) -- computes signed dx/dy deltas ($5x pairs) with sign flags in
// $33/$34, then twice waits on $6040 bit7, reads the $6060/$6070 math-box result into $63/$64 and
// $61/$62, and 16-bit add-or-subtracts the $66-$69 pair with saturating clamps. Two rts exits.
export function loc_c098(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x57); regs.setNZ(regs.a); m.step(0xc09a, 3);
  regs.sec(); m.step(0xc09b, 2);
  regs.sbc(mem.read8(0x5f)); m.step(0xc09d, 3);
  mem.write8(0x6095, regs.a); m.step(0xc0a0, 4);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc0a2, 2);
  regs.sbc(mem.read8(0x5b)); m.step(0xc0a4, 3);
  mem.write8(0x6096, regs.a); m.step(0xc0a7, 4);
  // c0a7 bpl 0xc0b3
  if (regs.fPl) {
    m.step(0xc0b3, 3);
  } else {
    m.step(0xc0a9, 2);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc0ab, 2);
    mem.write8(0x6096, regs.a); m.step(0xc0ae, 4);
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0xc0b0, 2);
    mem.write8(0x6095, regs.a); m.step(0xc0b3, 4);
  }
  // c0b3: |dx| into A, sign into X
  regs.a = mem.read8(0x58); regs.setNZ(regs.a); m.step(0xc0b5, 3);
  regs.cmp(mem.read8(0x60)); m.step(0xc0b7, 3);
  // c0b7 bcc 0xc0c0
  if (regs.fNC) {
    m.step(0xc0c0, 3);
    regs.a = mem.read8(0x60); regs.setNZ(regs.a); m.step(0xc0c2, 3);
    regs.sec(); m.step(0xc0c3, 2);
    regs.sbc(mem.read8(0x58)); m.step(0xc0c5, 3);
    regs.x = 0xff; regs.setNZ(regs.x); m.step(0xc0c7, 2);
  } else {
    m.step(0xc0b9, 2);
    regs.sbc(mem.read8(0x60)); m.step(0xc0bb, 3);
    regs.x = 0x00; regs.setNZ(regs.x); m.step(0xc0bd, 2);
    regs.clv(); m.step(0xc0be, 2);
    m.step(0xc0c7, 3);
  }
  // c0c7
  mem.write8(0x608e, regs.a); m.step(0xc0ca, 4);
  mem.write8(0x6094, regs.a); m.step(0xc0cd, 4);
  mem.write8(0x33, regs.x); m.step(0xc0cf, 3);
  // c0cf: |dy| into A, sign into X
  regs.a = mem.read8(0x56); regs.setNZ(regs.a); m.step(0xc0d1, 3);
  regs.cmp(mem.read8(0x5e)); m.step(0xc0d3, 3);
  // c0d3 bcc 0xc0dc
  if (regs.fNC) {
    m.step(0xc0dc, 3);
    regs.a = mem.read8(0x5e); regs.setNZ(regs.a); m.step(0xc0de, 3);
    regs.sec(); m.step(0xc0df, 2);
    regs.sbc(mem.read8(0x56)); m.step(0xc0e1, 3);
    regs.x = 0xff; regs.setNZ(regs.x); m.step(0xc0e3, 2);
  } else {
    m.step(0xc0d5, 2);
    regs.sbc(mem.read8(0x5e)); m.step(0xc0d7, 3);
    regs.x = 0x00; regs.setNZ(regs.x); m.step(0xc0d9, 2);
    regs.clv(); m.step(0xc0da, 2);
    m.step(0xc0e3, 3);
  }
  // c0e3
  mem.write8(0x32, regs.a); m.step(0xc0e5, 3);
  mem.write8(0x34, regs.x); m.step(0xc0e7, 3);
  // c0e7 bit 0x6040 / c0ea bmi 0xc0e7 -- spin while $6040 bit7 set
  while (true) {
    regs.bit(mem.read8(0x6040)); m.step(0xc0ea, 4);
    if (regs.fN) { m.step(0xc0e7, 3); continue; }
    m.step(0xc0ec, 2); break;
  }
  // c0ec
  regs.a = mem.read8(0x6060); regs.setNZ(regs.a); m.step(0xc0ef, 4);
  mem.write8(0x63, regs.a); m.step(0xc0f1, 3);
  regs.a = mem.read8(0x6070); regs.setNZ(regs.a); m.step(0xc0f4, 4);
  mem.write8(0x64, regs.a); m.step(0xc0f6, 3);
  regs.a = mem.read8(0x32); regs.setNZ(regs.a); m.step(0xc0f8, 3);
  mem.write8(0x608e, regs.a); m.step(0xc0fb, 4);
  mem.write8(0x6094, regs.a); m.step(0xc0fe, 4);
  regs.a = mem.read8(0x33); regs.setNZ(regs.a); m.step(0xc100, 3);
  // c100 bmi 0xc11a -- sign of dy selects subtract vs add of the $68/$69 pair into $63/$64
  if (regs.fN) {
    m.step(0xc11a, 3);
    regs.a = mem.read8(0x68); regs.setNZ(regs.a); m.step(0xc11c, 3);
    regs.sec(); m.step(0xc11d, 2);
    regs.sbc(mem.read8(0x63)); m.step(0xc11f, 3);
    mem.write8(0x63, regs.a); m.step(0xc121, 3);
    regs.a = mem.read8(0x69); regs.setNZ(regs.a); m.step(0xc123, 3);
    regs.sbc(mem.read8(0x64)); m.step(0xc125, 3);
    // c125 bvc 0xc12d
    if (regs.fNV) {
      m.step(0xc12d, 3);
    } else {
      m.step(0xc127, 2);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc129, 2);
      mem.write8(0x63, regs.a); m.step(0xc12b, 3);
      regs.a = 0x80; regs.setNZ(regs.a); m.step(0xc12d, 2);
    }
    mem.write8(0x64, regs.a); m.step(0xc12f, 3);
  } else {
    m.step(0xc102, 2);
    regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xc104, 3);
    regs.clc(); m.step(0xc105, 2);
    regs.adc(mem.read8(0x68)); m.step(0xc107, 3);
    mem.write8(0x63, regs.a); m.step(0xc109, 3);
    regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xc10b, 3);
    regs.adc(mem.read8(0x69)); m.step(0xc10d, 3);
    // c10d bvc 0xc115
    if (regs.fNV) {
      m.step(0xc115, 3);
    } else {
      m.step(0xc10f, 2);
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xc111, 2);
      mem.write8(0x63, regs.a); m.step(0xc113, 3);
      regs.a = 0x7f; regs.setNZ(regs.a); m.step(0xc115, 2);
    }
    mem.write8(0x64, regs.a); m.step(0xc117, 3);
    regs.clv(); m.step(0xc118, 2);
    m.step(0xc12f, 3);
  }
  // c12f bit 0x6040 / c132 bmi 0xc12f -- spin while $6040 bit7 set
  while (true) {
    regs.bit(mem.read8(0x6040)); m.step(0xc132, 4);
    if (regs.fN) { m.step(0xc12f, 3); continue; }
    m.step(0xc134, 2); break;
  }
  // c134
  regs.a = mem.read8(0x6060); regs.setNZ(regs.a); m.step(0xc137, 4);
  mem.write8(0x61, regs.a); m.step(0xc139, 3);
  regs.a = mem.read8(0x6070); regs.setNZ(regs.a); m.step(0xc13c, 4);
  mem.write8(0x62, regs.a); m.step(0xc13e, 3);
  regs.x = mem.read8(0x34); regs.setNZ(regs.x); m.step(0xc140, 3);
  // c140 bmi 0xc158 -- sign of dx selects subtract vs add of the $66/$67 pair into $61/$62
  if (regs.fN) {
    m.step(0xc158, 3);
    regs.a = mem.read8(0x66); regs.setNZ(regs.a); m.step(0xc15a, 3);
    regs.sec(); m.step(0xc15b, 2);
    regs.sbc(mem.read8(0x61)); m.step(0xc15d, 3);
    mem.write8(0x61, regs.a); m.step(0xc15f, 3);
    regs.a = mem.read8(0x67); regs.setNZ(regs.a); m.step(0xc161, 3);
    regs.sbc(mem.read8(0x62)); m.step(0xc163, 3);
    // c163 bvc 0xc16b
    if (regs.fNV) {
      m.step(0xc16b, 3);
    } else {
      m.step(0xc165, 2);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc167, 2);
      mem.write8(0x61, regs.a); m.step(0xc169, 3);
      regs.a = 0x80; regs.setNZ(regs.a); m.step(0xc16b, 2);
    }
    mem.write8(0x62, regs.a); m.step(0xc16d, 3);
    return m.ret(6);
  } else {
    m.step(0xc142, 2);
    regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xc144, 3);
    regs.clc(); m.step(0xc145, 2);
    regs.adc(mem.read8(0x66)); m.step(0xc147, 3);
    mem.write8(0x61, regs.a); m.step(0xc149, 3);
    regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xc14b, 3);
    regs.adc(mem.read8(0x67)); m.step(0xc14d, 3);
    // c14d bvc 0xc155
    if (regs.fNV) {
      m.step(0xc155, 3);
    } else {
      m.step(0xc14f, 2);
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xc151, 2);
      mem.write8(0x61, regs.a); m.step(0xc153, 3);
      regs.a = 0x7f; regs.setNZ(regs.a); m.step(0xc155, 2);
    }
    mem.write8(0x62, regs.a); m.step(0xc157, 3);
    return m.ret(6);
  }
}
