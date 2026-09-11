// SPDX-License-Identifier: GPL-3.0-only
// loc_96cb (ROM 0x96cb-0x96da) -- read (0x2c),y, subtract the previous entry (0x2c),y-1, then re-index Y by
// that delta and advance by 2. A vector-list coordinate walker; dispatch target ($969d table).
export function loc_96cb(m) {
  const { regs, mem } = m;
  let p = mem.read8(0x2c) | (mem.read8(0x2d) << 8), e = (p + regs.y) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x96cd, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0));
  regs.y = regs.dec8(regs.y); m.step(0x96ce, 2);
  regs.sec(); m.step(0x96cf, 2);
  e = (p + regs.y) & 0xffff;
  regs.sbc(mem.read8(e)); m.step(0x96d1, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0));
  mem.write8(0x29, regs.a); m.step(0x96d3, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0x96d4, 2);
  regs.sec(); m.step(0x96d5, 2);
  regs.adc(mem.read8(0x29)); m.step(0x96d7, 3);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x96d8, 2);
  regs.y = regs.inc8(regs.y); m.step(0x96d9, 2);
  regs.y = regs.inc8(regs.y); m.step(0x96da, 2);
  return m.ret(6);
}
