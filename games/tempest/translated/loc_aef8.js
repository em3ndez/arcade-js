// SPDX-License-Identifier: GPL-3.0-only
// loc_aef8  (ROM 0xaef8-0xaf25) -- (A+2)->$38 slot count; loop copies 2-byte glyph words from
// $31fa+ (index = 2*min(cell,0x1a)) via ($74),y, then dey and tail-jmps to $df5f.
export function loc_aef8(m) {
  const { regs, mem } = m;
  regs.clc(); m.step(0xaef9, 2);
  regs.adc(0x02); m.step(0xaefb, 2);
  mem.write8(0x38, regs.a); m.step(0xaefd, 3);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xaeff, 2);
  regs.a = 0x02; regs.setNZ(regs.a); m.step(0xaf01, 2);
  mem.write8(0x39, regs.a); m.step(0xaf03, 3);
  while (true) {
    regs.x = mem.read8(0x38); regs.setNZ(regs.x); m.step(0xaf05, 3);
    { const b = 0x0606, ad = (b + regs.x) & 0xffff; regs.a = mem.read8(ad); regs.setNZ(regs.a); m.step(0xaf08, 4 + ((b ^ ad) & 0xff00 ? 1 : 0)); }
    regs.cmp(0x1e); m.step(0xaf0a, 2);
    if (regs.fNC) {
      m.step(0xaf0e, 3);
    } else {
      m.step(0xaf0c, 2);
      regs.a = 0x1a; regs.setNZ(regs.a); m.step(0xaf0e, 2);
    }
    regs.a = regs.asl(regs.a); m.step(0xaf0f, 2);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xaf10, 2);
    { const b = 0x31fa, ad = (b + regs.x) & 0xffff; regs.a = mem.read8(ad); regs.setNZ(regs.a); m.step(0xaf13, 4 + ((b ^ ad) & 0xff00 ? 1 : 0)); }
    { const p = mem.read8(0x74) | (mem.read8(0x75) << 8); mem.write8((p + regs.y) & 0xffff, regs.a); } m.step(0xaf15, 6);
    regs.y = regs.inc8(regs.y); m.step(0xaf16, 2);
    { const b = 0x31fb, ad = (b + regs.x) & 0xffff; regs.a = mem.read8(ad); regs.setNZ(regs.a); m.step(0xaf19, 4 + ((b ^ ad) & 0xff00 ? 1 : 0)); }
    { const p = mem.read8(0x74) | (mem.read8(0x75) << 8); mem.write8((p + regs.y) & 0xffff, regs.a); } m.step(0xaf1b, 6);
    regs.y = regs.inc8(regs.y); m.step(0xaf1c, 2);
    mem.write8(0x38, regs.dec8(mem.read8(0x38))); m.step(0xaf1e, 5);
    mem.write8(0x39, regs.dec8(mem.read8(0x39))); m.step(0xaf20, 5);
    if (regs.fPl) { m.step(0xaf03, 3); continue; }
    m.step(0xaf22, 2); break;
  }
  regs.y = regs.dec8(regs.y); m.step(0xaf23, 2);
  m.step(0xdf5f, 3); return m.call(0xdf5f);
}
