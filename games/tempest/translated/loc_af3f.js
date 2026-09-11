// SPDX-License-Identifier: GPL-3.0-only
// loc_af3f  (ROM 0xaf3f-0xaf6e) -- draw one slot: if $0600,x == 0 rts; else render the count (capped
// via $af71) at a per-slot position ($af6f table), then jsr $ab98/$aa9e; rts.
export function loc_af3f(m) {
  const { regs, mem } = m;
  { const b = 0x0600, ad = (b + regs.x) & 0xffff; regs.a = mem.read8(ad); regs.setNZ(regs.a); m.step(0xaf42, 4 + ((b ^ ad) & 0xff00 ? 1 : 0)); }
  if (regs.fZ) { m.step(0xaf6e, 3); return m.ret(6); }
  m.step(0xaf44, 2);
  m.push8(regs.a); m.step(0xaf45, 3);
  mem.write8(0x2e, regs.x); m.step(0xaf47, 3);
  regs.y = 0x03; regs.setNZ(regs.y); m.step(0xaf49, 2);
  m.push16(0xaf4b); m.step(0xaf4c, 6); m.call(0xb0d1);
  m.push16(0xaf4e); m.step(0xaf4f, 6); m.call(0xab0d);
  regs.a = 0xd0; regs.setNZ(regs.a); m.step(0xaf51, 2);
  regs.y = mem.read8(0x2e); regs.setNZ(regs.y); m.step(0xaf53, 3);
  { const b = 0xaf6f, ad = (b + regs.y) & 0xffff; regs.x = mem.read8(ad); regs.setNZ(regs.x); m.step(0xaf56, 4 + ((b ^ ad) & 0xff00 ? 1 : 0)); }
  m.push16(0xaf58); m.step(0xaf59, 6); m.call(0xdf75);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xaf5a, 4);
  m.push16(0xaf5c); m.step(0xaf5d, 6); m.call(0xaf71);
  regs.a = 0xa0; regs.setNZ(regs.a); m.step(0xaf5f, 2);
  m.push16(0xaf61); m.step(0xaf62, 6); m.call(0xb56a);
  regs.a = 0x10; regs.setNZ(regs.a); m.step(0xaf64, 2);
  regs.x = 0x04; regs.setNZ(regs.x); m.step(0xaf66, 2);
  m.push16(0xaf68); m.step(0xaf69, 6); m.call(0xab98);
  regs.x = mem.read8(0x2e); regs.setNZ(regs.x); m.step(0xaf6b, 3);
  m.push16(0xaf6d); m.step(0xaf6e, 6); m.call(0xaa9e);
  return m.ret(6);
}
