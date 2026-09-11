// SPDX-License-Identifier: GPL-3.0-only
// loc_cf24  (ROM 0xcf24-0xd030) -- 3-lane update loop over $0d/$10/$13,x driven by $08 bits, then
// score/position accumulation via $16/$17/$18 (data table 0xcfd9), then two $13,x fix-up passes.
// Goto-dense; modeled as a basic-block dispatch (label = the 6502 target address) to stay faithful.
export function loc_cf24(m) {
  const { regs, mem } = m;
  regs.x = 0x02; regs.setNZ(regs.x); m.step(0xcf26, 2);
  let label = 0xcf26;
  while (true) {
    switch (label) {
      case 0xcf26: {
        regs.a = mem.read8(0x0008); regs.setNZ(regs.a); m.step(0xcf29, 4);
        regs.cpx(0x01); m.step(0xcf2b, 2);
        if (regs.fZ) {
          m.step(0xcf30, 3);
          regs.a = regs.lsr(regs.a); m.step(0xcf31, 2);
          regs.a = regs.lsr(regs.a); m.step(0xcf32, 2);
        } else {
          m.step(0xcf2d, 2);
          if (regs.fC) {
            m.step(0xcf31, 3);
            regs.a = regs.lsr(regs.a); m.step(0xcf32, 2);
          } else {
            m.step(0xcf2f, 2);
            regs.a = regs.lsr(regs.a); m.step(0xcf30, 2);
            regs.a = regs.lsr(regs.a); m.step(0xcf31, 2);
            regs.a = regs.lsr(regs.a); m.step(0xcf32, 2);
          }
        }
        regs.a = mem.read8((0x0d + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcf34, 4);
        regs.and(0x1f); m.step(0xcf36, 2);
        if (regs.fC) { m.step(0xcf6f, 3); label = 0xcf6f; break; }
        m.step(0xcf38, 2);
        if (regs.fZ) { m.step(0xcf4a, 3); label = 0xcf4a; break; }
        m.step(0xcf3a, 2);
        regs.cmp(0x1b); m.step(0xcf3c, 2);
        if (regs.fC) { m.step(0xcf48, 3); label = 0xcf48; break; }
        m.step(0xcf3e, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0xcf3f, 2);
        regs.a = mem.read8(0x07); regs.setNZ(regs.a); m.step(0xcf41, 3);
        regs.and(0x07); m.step(0xcf43, 2);
        regs.cmp(0x07); m.step(0xcf45, 2);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0xcf46, 2);
        if (regs.fNC) { m.step(0xcf4a, 3); label = 0xcf4a; break; }
        m.step(0xcf48, 2);
        label = 0xcf48; break;
      }
      case 0xcf48: {
        regs.sbc(0x01); m.step(0xcf4a, 2);
        label = 0xcf4a; break;
      }
      case 0xcf4a: {
        mem.write8((0x0d + regs.x) & 0xff, regs.a); m.step(0xcf4c, 4);
        regs.a = mem.read8(0x0008); regs.setNZ(regs.a); m.step(0xcf4f, 4);
        regs.and(0x08); m.step(0xcf51, 2);
        if (regs.fNZ) { m.step(0xcf57, 3); label = 0xcf57; break; }
        m.step(0xcf53, 2);
        regs.a = 0xf0; regs.setNZ(regs.a); m.step(0xcf55, 2);
        mem.write8(0x0c, regs.a); m.step(0xcf57, 3);
        label = 0xcf57; break;
      }
      case 0xcf57: {
        regs.a = mem.read8(0x0c); regs.setNZ(regs.a); m.step(0xcf59, 3);
        if (regs.fZ) { m.step(0xcf63, 3); label = 0xcf63; break; }
        m.step(0xcf5b, 2);
        mem.write8(0x0c, regs.dec8(mem.read8(0x0c))); m.step(0xcf5d, 5);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0xcf5f, 2);
        mem.write8((0x0d + regs.x) & 0xff, regs.a); m.step(0xcf61, 4);
        mem.write8((0x10 + regs.x) & 0xff, regs.a); m.step(0xcf63, 4);
        label = 0xcf63; break;
      }
      case 0xcf63: {
        regs.clc(); m.step(0xcf64, 2);
        regs.a = mem.read8((0x10 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcf66, 4);
        if (regs.fZ) { m.step(0xcf8b, 3); label = 0xcf8b; break; }
        m.step(0xcf68, 2);
        mem.write8((0x10 + regs.x) & 0xff, regs.dec8(mem.read8((0x10 + regs.x) & 0xff))); m.step(0xcf6a, 6);
        if (regs.fNZ) { m.step(0xcf8b, 3); label = 0xcf8b; break; }
        m.step(0xcf6c, 2);
        regs.sec(); m.step(0xcf6d, 2);
        m.step(0xcf8b, 3); label = 0xcf8b; break;
      }
      case 0xcf6f: {
        regs.cmp(0x1b); m.step(0xcf71, 2);
        if (regs.fC) { m.step(0xcf7c, 3); label = 0xcf7c; break; }
        m.step(0xcf73, 2);
        regs.a = mem.read8((0x0d + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcf75, 4);
        regs.adc(0x20); m.step(0xcf77, 2);
        if (regs.fNC) { m.step(0xcf4a, 3); label = 0xcf4a; break; }
        m.step(0xcf79, 2);
        if (regs.fZ) { m.step(0xcf7c, 3); label = 0xcf7c; break; }
        m.step(0xcf7b, 2);
        regs.clc(); m.step(0xcf7c, 2);
        label = 0xcf7c; break;
      }
      case 0xcf7c: {
        regs.a = 0x1f; regs.setNZ(regs.a); m.step(0xcf7e, 2);
        if (regs.fC) { m.step(0xcf4a, 3); label = 0xcf4a; break; }
        m.step(0xcf80, 2);
        mem.write8((0x0d + regs.x) & 0xff, regs.a); m.step(0xcf82, 4);
        regs.a = mem.read8((0x10 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcf84, 4);
        if (regs.fZ) { m.step(0xcf87, 3); label = 0xcf87; break; }
        m.step(0xcf86, 2);
        regs.sec(); m.step(0xcf87, 2);
        label = 0xcf87; break;
      }
      case 0xcf87: {
        regs.a = 0x78; regs.setNZ(regs.a); m.step(0xcf89, 2);
        mem.write8((0x10 + regs.x) & 0xff, regs.a); m.step(0xcf8b, 4);
        label = 0xcf8b; break;
      }
      case 0xcf8b: {
        if (regs.fNC) { m.step(0xcfb7, 3); label = 0xcfb7; break; }
        m.step(0xcf8d, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0xcf8f, 2);
        regs.cpx(0x01); m.step(0xcf91, 2);
        if (regs.fNC) { m.step(0xcfa9, 3); label = 0xcfa9; break; }
        m.step(0xcf93, 2);
        if (regs.fZ) { m.step(0xcfa1, 3); label = 0xcfa1; break; }
        m.step(0xcf95, 2);
        regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xcf97, 3);
        regs.and(0x0c); m.step(0xcf99, 2);
        regs.a = regs.lsr(regs.a); m.step(0xcf9a, 2);
        regs.a = regs.lsr(regs.a); m.step(0xcf9b, 2);
        if (regs.fZ) { m.step(0xcfa9, 3); label = 0xcfa9; break; }
        m.step(0xcf9d, 2);
        regs.adc(0x02); m.step(0xcf9f, 2);
        if (regs.fNZ) { m.step(0xcfa9, 3); label = 0xcfa9; break; }
        m.step(0xcfa1, 2); label = 0xcfa1; break;
      }
      case 0xcfa1: {
        regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xcfa3, 3);
        regs.and(0x10); m.step(0xcfa5, 2);
        if (regs.fZ) { m.step(0xcfa9, 3); label = 0xcfa9; break; }
        m.step(0xcfa7, 2);
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0xcfa9, 2);
        label = 0xcfa9; break;
      }
      case 0xcfa9: {
        regs.sec(); m.step(0xcfaa, 2);
        m.push8(regs.a); m.step(0xcfab, 3);
        regs.adc(mem.read8(0x16)); m.step(0xcfad, 3);
        mem.write8(0x16, regs.a); m.step(0xcfaf, 3);
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xcfb0, 4);
        regs.sec(); m.step(0xcfb1, 2);
        regs.adc(mem.read8(0x17)); m.step(0xcfb3, 3);
        mem.write8(0x17, regs.a); m.step(0xcfb5, 3);
        mem.write8((0x13 + regs.x) & 0xff, regs.inc8(mem.read8((0x13 + regs.x) & 0xff))); m.step(0xcfb7, 6);
        label = 0xcfb7; break;
      }
      case 0xcfb7: {
        regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xcfb8, 2);
        if (regs.fN) { m.step(0xcfbd, 3); label = 0xcfbd; break; }
        m.step(0xcfba, 2);
        m.step(0xcf26, 3); label = 0xcf26; break;
      }
      case 0xcfbd: {
        regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xcfbf, 3);
        regs.a = regs.lsr(regs.a); m.step(0xcfc0, 2);
        regs.a = regs.lsr(regs.a); m.step(0xcfc1, 2);
        regs.a = regs.lsr(regs.a); m.step(0xcfc2, 2);
        regs.a = regs.lsr(regs.a); m.step(0xcfc3, 2);
        regs.a = regs.lsr(regs.a); m.step(0xcfc4, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0xcfc5, 2);
        regs.a = mem.read8(0x16); regs.setNZ(regs.a); m.step(0xcfc7, 3);
        regs.sec(); m.step(0xcfc8, 2);
        regs.sbc(mem.read8((0xcfd9 + regs.y) & 0xffff)); m.step(0xcfcb, 4);
        if (regs.fN) { m.step(0xcfe1, 3); label = 0xcfe1; break; }
        m.step(0xcfcd, 2);
        mem.write8(0x16, regs.a); m.step(0xcfcf, 3);
        mem.write8(0x18, regs.inc8(mem.read8(0x18))); m.step(0xcfd1, 5);
        regs.cpy(0x03); m.step(0xcfd3, 2);
        if (regs.fNZ) { m.step(0xcfe1, 3); label = 0xcfe1; break; }
        m.step(0xcfd5, 2);
        mem.write8(0x18, regs.inc8(mem.read8(0x18))); m.step(0xcfd7, 5);
        if (regs.fNZ) { m.step(0xcfe1, 3); label = 0xcfe1; break; }
        m.step(0xcfd9, 2);
        // cfd7 bne not-taken falls into the 0xcfd9 data table (0x7f...) -- executing data.
        // The code places its lookup table here and relies on this bne being always-taken;
        // reaching it means mem[0x18] wrapped 0xff->0x00, an invalid state. Flag, do not guess.
        throw new Error('loc_cf24: fell through cfd7 bne into data table 0xcfd9 -- unreachable in valid state (mem[0x18] wrapped)');
      }
      case 0xcfe1: {
        regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xcfe3, 3);
        regs.and(0x03); m.step(0xcfe5, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0xcfe6, 2);
        if (regs.fZ) { m.step(0xd002, 4); label = 0xd002; break; }
        m.step(0xcfe8, 2);
        regs.a = regs.lsr(regs.a); m.step(0xcfe9, 2);
        regs.adc(0x00); m.step(0xcfeb, 2);
        regs.eor(0xff); m.step(0xcfed, 2);
        regs.sec(); m.step(0xcfee, 2);
        regs.adc(mem.read8(0x17)); m.step(0xcff0, 3);
        if (regs.fC) { m.step(0xcffa, 3); label = 0xcffa; break; }
        m.step(0xcff2, 2);
        regs.adc(mem.read8(0x18)); m.step(0xcff4, 3);
        if (regs.fN) { m.step(0xd004, 4); label = 0xd004; break; }
        m.step(0xcff6, 2);
        mem.write8(0x18, regs.a); m.step(0xcff8, 3);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0xcffa, 2);
        label = 0xcffa; break;
      }
      case 0xcffa: {
        regs.cpy(0x02); m.step(0xcffc, 2);
        if (regs.fC) { m.step(0xd000, 4); label = 0xd000; break; }
        m.step(0xcffe, 2);
        mem.write8(0x06, regs.inc8(mem.read8(0x06))); m.step(0xd000, 5);
        label = 0xd000; break;
      }
      case 0xd000: {
        mem.write8(0x06, regs.inc8(mem.read8(0x06))); m.step(0xd002, 5);
        label = 0xd002; break;
      }
      case 0xd002: {
        mem.write8(0x17, regs.a); m.step(0xd004, 3);
        label = 0xd004; break;
      }
      case 0xd004: {
        regs.a = mem.read8(0x07); regs.setNZ(regs.a); m.step(0xd006, 3);
        regs.a = regs.lsr(regs.a); m.step(0xd007, 2);
        if (regs.fC) { m.step(0xd030, 3); label = 0xd030; break; }
        m.step(0xd009, 2);
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0xd00b, 2);
        regs.x = 0x02; regs.setNZ(regs.x); m.step(0xd00d, 2);
        label = 0xd00d; break;
      }
      case 0xd00d: {
        regs.a = mem.read8((0x13 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xd00f, 4);
        if (regs.fZ) { m.step(0xd01a, 3); label = 0xd01a; break; }
        m.step(0xd011, 2);
        regs.cmp(0x10); m.step(0xd013, 2);
        if (regs.fNC) { m.step(0xd01a, 3); label = 0xd01a; break; }
        m.step(0xd015, 2);
        regs.adc(0xef); m.step(0xd017, 2);
        regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xd018, 2);
        mem.write8((0x13 + regs.x) & 0xff, regs.a); m.step(0xd01a, 4);
        label = 0xd01a; break;
      }
      case 0xd01a: {
        regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xd01b, 2);
        if (regs.fPl) { m.step(0xd00d, 3); label = 0xd00d; break; }
        m.step(0xd01d, 2);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0xd01e, 2);
        if (regs.fNZ) { m.step(0xd030, 3); label = 0xd030; break; }
        m.step(0xd020, 2);
        regs.x = 0x02; regs.setNZ(regs.x); m.step(0xd022, 2);
        label = 0xd022; break;
      }
      case 0xd022: {
        regs.a = mem.read8((0x13 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xd024, 4);
        if (regs.fZ) { m.step(0xd02d, 3); label = 0xd02d; break; }
        m.step(0xd026, 2);
        regs.clc(); m.step(0xd027, 2);
        regs.adc(0xef); m.step(0xd029, 2);
        mem.write8((0x13 + regs.x) & 0xff, regs.a); m.step(0xd02b, 4);
        if (regs.fN) { m.step(0xd030, 3); label = 0xd030; break; }
        m.step(0xd02d, 2);
        label = 0xd02d; break;
      }
      case 0xd02d: {
        regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xd02e, 2);
        if (regs.fPl) { m.step(0xd022, 3); label = 0xd022; break; }
        m.step(0xd030, 2);
        label = 0xd030; break;
      }
      case 0xd030: {
        return m.ret(6);
      }
    }
  }
}
