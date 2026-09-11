// SPDX-License-Identifier: GPL-3.0-only
// loc_c16e  (ROM 0xc16e-0xc1c2) -- inits $5e/$0114, calls loc_aa13 + loc_c235, clears $0133 (writing
// $5800 first when $0133==0), copies $cec6/$cec7 -> $2000/$2001, then unpacks the $c1fd table (indexed
// by a clamped $9f) into the $0019/$0021 and $0800/$0808 arrays via an 8-entry down-loop.
export function loc_c16e(m) {
  const { regs, mem } = m;
  m.push16(0xc170); m.step(0xc171, 6); m.call(0xaa13);
  regs.a = 0x80; regs.setNZ(0x80); m.step(0xc173, 2);
  mem.write8(0x5e, regs.a); m.step(0xc175, 3);
  regs.a = 0xff; regs.setNZ(0xff); m.step(0xc177, 2);
  mem.write8(0x0114, regs.a); m.step(0xc17a, 4);
  m.push16(0xc17c); m.step(0xc17d, 6); m.call(0xc235);
  regs.a = mem.read8(0x0133); regs.setNZ(regs.a); m.step(0xc180, 4);
  if (regs.fNZ) {
    m.step(0xc185, 3);
  } else {
    m.step(0xc182, 2);
    mem.write8(0x5800, regs.a); m.step(0xc185, 4);
  }
  regs.a = 0x00; regs.setNZ(0x00); m.step(0xc187, 2);
  mem.write8(0x0133, regs.a); m.step(0xc18a, 4);
  regs.a = mem.read8(0xcec6); regs.setNZ(regs.a); m.step(0xc18d, 4);
  mem.write8(0x2000, regs.a); m.step(0xc190, 4);
  regs.a = mem.read8(0xcec7); regs.setNZ(regs.a); m.step(0xc193, 4);
  mem.write8(0x2001, regs.a); m.step(0xc196, 4);
  regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0xc198, 3);
  regs.and(0x70); m.step(0xc19a, 2);
  regs.cmp(0x5f); m.step(0xc19c, 2);
  if (regs.fNC) {
    m.step(0xc1a0, 3);
  } else {
    m.step(0xc19e, 2);
    regs.a = 0x5f; regs.setNZ(0x5f); m.step(0xc1a0, 2);
  }
  regs.a = regs.lsr(regs.a); m.step(0xc1a1, 2);
  regs.ora(0x07); m.step(0xc1a3, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xc1a4, 2);
  regs.y = 0x07; regs.setNZ(0x07); m.step(0xc1a6, 2);
  do {
    regs.a = mem.read8((0xc1fd + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc1a9, 4 + ((0xc1fd & 0xff00) !== ((0xc1fd + regs.x) & 0xffff & 0xff00) ? 1 : 0));
    regs.and(0x0f); m.step(0xc1ab, 2);
    mem.write8((0x0019 + regs.y) & 0xffff, regs.a); m.step(0xc1ae, 5);
    mem.write8((0x0800 + regs.y) & 0xffff, regs.a); m.step(0xc1b1, 5);
    regs.a = mem.read8((0xc1fd + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc1b4, 4 + ((0xc1fd & 0xff00) !== ((0xc1fd + regs.x) & 0xffff & 0xff00) ? 1 : 0));
    regs.a = regs.lsr(regs.a); m.step(0xc1b5, 2);
    regs.a = regs.lsr(regs.a); m.step(0xc1b6, 2);
    regs.a = regs.lsr(regs.a); m.step(0xc1b7, 2);
    regs.a = regs.lsr(regs.a); m.step(0xc1b8, 2);
    mem.write8((0x0021 + regs.y) & 0xffff, regs.a); m.step(0xc1bb, 5);
    mem.write8((0x0808 + regs.y) & 0xffff, regs.a); m.step(0xc1be, 5);
    regs.x = regs.dec8(regs.x); m.step(0xc1bf, 2);
    regs.y = regs.dec8(regs.y); m.step(0xc1c0, 2);
    if (regs.fPl) { m.step(0xc1a6, 3); } else { m.step(0xc1c2, 2); break; }
  } while (true);
  return m.ret(6);
}
