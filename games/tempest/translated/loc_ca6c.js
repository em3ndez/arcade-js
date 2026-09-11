// SPDX-License-Identifier: GPL-3.0-only
// loc_ca6c  (ROM 0xca6c-0xcaf0) -- BCD (sed) multi-byte add into the $0040+y score triplet (bonus vs table
//   $caf1/$caf9,x), then range-checks vs $0156/$2b and, when a $48,x counter is under 6, bumps it + fires
//   sound loc_ccb9 and sets $0124. Irreducible CFG modelled as an in-routine address-dispatch state machine.
export function loc_ca6c(m) {
  const { regs, mem } = m;
  let state = 0xca6c;
  while (true) {
    switch (state) {
      case 0xca6c: {
        regs.sed(); m.step(0xca6d, 2);
        regs.bit(mem.read8(0x05)); m.step(0xca6f, 3);
        if (regs.fPl) { m.step(0xcaef, 3); state = 0xcaef; continue; }
        m.step(0xca71, 2);
        regs.y = mem.read8(0x3d); regs.setNZ(regs.y); m.step(0xca73, 3);
        if (regs.fZ) { m.step(0xca77, 3); state = 0xca77; continue; }
        m.step(0xca75, 2);
        regs.y = 0x03; regs.setNZ(regs.y); m.step(0xca77, 2);
      }
      case 0xca77: {
        regs.cpx(0x08); m.step(0xca79, 2);
        if (regs.fNC) { m.step(0xca91, 3); state = 0xca91; continue; }
        m.step(0xca7b, 2);
        regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xca7d, 3);
        regs.clc(); m.step(0xca7e, 2);
        { const b = 0x0040, ad = (b + regs.y) & 0xffff, pc = ((b ^ ad) & 0xff00) ? 1 : 0;
          regs.adc(mem.read8(ad)); m.step(0xca81, 4 + pc); }
        mem.write8((0x0040 + regs.y) & 0xffff, regs.a); m.step(0xca84, 5);
        regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0xca86, 3);
        { const b = 0x0041, ad = (b + regs.y) & 0xffff, pc = ((b ^ ad) & 0xff00) ? 1 : 0;
          regs.adc(mem.read8(ad)); m.step(0xca89, 4 + pc); }
        mem.write8((0x0041 + regs.y) & 0xffff, regs.a); m.step(0xca8c, 5);
        regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0xca8e, 3);
        regs.clv(); m.step(0xca8f, 2);
        m.step(0xcaa6, 3); state = 0xcaa6; continue;
      }
      case 0xca91: {
        { const b = 0xcaf1, ad = (b + regs.x) & 0xffff, pc = ((b ^ ad) & 0xff00) ? 1 : 0;
          regs.a = mem.read8(ad); regs.setNZ(regs.a); m.step(0xca94, 4 + pc); }
        regs.clc(); m.step(0xca95, 2);
        { const b = 0x0040, ad = (b + regs.y) & 0xffff, pc = ((b ^ ad) & 0xff00) ? 1 : 0;
          regs.adc(mem.read8(ad)); m.step(0xca98, 4 + pc); }
        mem.write8((0x0040 + regs.y) & 0xffff, regs.a); m.step(0xca9b, 5);
        { const b = 0xcaf9, ad = (b + regs.x) & 0xffff, pc = ((b ^ ad) & 0xff00) ? 1 : 0;
          regs.a = mem.read8(ad); regs.setNZ(regs.a); m.step(0xca9e, 4 + pc); }
        { const b = 0x0041, ad = (b + regs.y) & 0xffff, pc = ((b ^ ad) & 0xff00) ? 1 : 0;
          regs.adc(mem.read8(ad)); m.step(0xcaa1, 4 + pc); }
        mem.write8((0x0041 + regs.y) & 0xffff, regs.a); m.step(0xcaa4, 5);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0xcaa6, 2);
      }
      case 0xcaa6: {
        m.push8(regs.p); m.step(0xcaa7, 3);
        { const b = 0x0042, ad = (b + regs.y) & 0xffff, pc = ((b ^ ad) & 0xff00) ? 1 : 0;
          regs.adc(mem.read8(ad)); m.step(0xcaaa, 4 + pc); }
        mem.write8((0x0042 + regs.y) & 0xffff, regs.a); m.step(0xcaad, 5);
        regs.p = m.pull8(); m.step(0xcaae, 4);
        if (regs.fZ) { m.step(0xcabb, 3); state = 0xcabb; continue; }
        m.step(0xcab0, 2);
        regs.x = mem.read8(0x0156); regs.setNZ(regs.x); m.step(0xcab3, 4);
        if (regs.fZ) { m.step(0xcabb, 3); state = 0xcabb; continue; }
        m.step(0xcab5, 2);
        regs.cpx(mem.read8(0x2b)); m.step(0xcab7, 3);
        if (regs.fZ) { m.step(0xcadc, 3); state = 0xcadc; continue; }
        m.step(0xcab9, 2);
        if (regs.fNC) { m.step(0xcadc, 3); state = 0xcadc; continue; }
        m.step(0xcabb, 2);
      }
      case 0xcabb: {
        if (regs.fNC) { m.step(0xcaef, 3); state = 0xcaef; continue; }
        m.step(0xcabd, 2);
        regs.x = mem.read8(0x0156); regs.setNZ(regs.x); m.step(0xcac0, 4);
        if (regs.fZ) { m.step(0xcaee, 3); state = 0xcaee; continue; }
        m.step(0xcac2, 2);
        regs.cpx(0x03); m.step(0xcac4, 2);
        if (regs.fNC) { m.step(0xcad1, 3); state = 0xcad1; continue; }
        m.step(0xcac6, 2);
      }
      case 0xcac6: {
        regs.sec(); m.step(0xcac7, 2);
        regs.sbc(mem.read8(0x0156)); m.step(0xcaca, 4);
        if (regs.fZ) { m.step(0xcadc, 3); state = 0xcadc; continue; }
        m.step(0xcacc, 2);
        if (regs.fC) { m.step(0xcac6, 3); state = 0xcac6; continue; }
        m.step(0xcace, 2);
        regs.clv(); m.step(0xcacf, 2);
        m.step(0xcaee, 3); state = 0xcaee; continue;
      }
      case 0xcad1: {
        regs.cpx(0x02); m.step(0xcad3, 2);
        if (regs.fNZ) { m.step(0xcadc, 3); state = 0xcadc; continue; }
        m.step(0xcad5, 2);
        regs.and(0x01); m.step(0xcad7, 2);
        if (regs.fZ) { m.step(0xcadc, 3); state = 0xcadc; continue; }
        m.step(0xcad9, 2);
        regs.clv(); m.step(0xcada, 2);
        m.step(0xcaee, 3); state = 0xcaee; continue;
      }
      case 0xcadc: {
        regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xcade, 3);
        regs.a = mem.read8((0x48 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcae0, 4);
        regs.cmp(0x06); m.step(0xcae2, 2);
        if (regs.fC) { m.step(0xcaee, 3); state = 0xcaee; continue; }
        m.step(0xcae4, 2);
        mem.write8((0x48 + regs.x) & 0xff, regs.inc8(mem.read8((0x48 + regs.x) & 0xff))); m.step(0xcae6, 6);
        m.push16((0xcae6 + 2) & 0xffff); m.step(0xcae9, 6); m.call(0xccb9);
        regs.a = 0x20; regs.setNZ(regs.a); m.step(0xcaeb, 2);
        mem.write8(0x0124, regs.a); m.step(0xcaee, 4);
      }
      case 0xcaee: {
        regs.sec(); m.step(0xcaef, 2);
      }
      case 0xcaef: {
        regs.cld(); m.step(0xcaf0, 2);
        return m.ret(6);
      }
    }
  }
}
