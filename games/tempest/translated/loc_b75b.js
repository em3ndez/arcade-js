// SPDX-License-Identifier: GPL-3.0-only
// loc_b75b  (ROM 0xb75b-0xb799) -- loops X=$37 0x0b..0 over $02d3,x (skip if 0): stores to $57/$2f, then for
// X<8 loads A=8 else builds (($03<<1)&6)+0x20, and jsr $bcfd. After the loop picks Y (4/0x0b/0x0c) from
// $0135 vs 6/8 and writes it to $0808. rts.
export function loc_b75b(m) {
  const { regs, mem } = m;
  regs.x = 0x0b; regs.setNZ(regs.x); m.step(0xb75d, 2);
  mem.write8(0x37, regs.x); m.step(0xb75f, 3);
  while (true) {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xb761, 3);
    { const a = (0x02d3 + regs.x) & 0xffff;
      regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb764, 4 + ((0x02d3 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
    if (regs.fZ) {
      m.step(0xb781, 3);
    } else {
      m.step(0xb766, 2);
      mem.write8(0x57, regs.a); m.step(0xb768, 3);
      mem.write8(0x2f, regs.a); m.step(0xb76a, 3);
      regs.cpx(0x08); m.step(0xb76c, 2);
      { const a = (0x02ad + regs.x) & 0xffff;
        regs.y = mem.read8(a); regs.setNZ(regs.y); m.step(0xb76f, 4 + ((0x02ad & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
      if (regs.fC) {
        m.step(0xb776, 3);
        regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xb778, 3);
        regs.a = regs.asl(regs.a); m.step(0xb779, 2);
        regs.and(0x06); m.step(0xb77b, 2);
        regs.clc(); m.step(0xb77c, 2);
        regs.adc(0x20); m.step(0xb77e, 2);
      } else {
        m.step(0xb771, 2);
        regs.a = 0x08; regs.setNZ(regs.a); m.step(0xb773, 2);
        regs.clv(); m.step(0xb774, 2);
        m.step(0xb77e, 3);
      }
      m.push16(0xb780); m.step(0xb781, 6); m.call(0xbcfd);
    }
    { const dv = (mem.read8(0x37) - 1) & 0xff; mem.write8(0x37, dv); regs.setNZ(dv); m.step(0xb783, 5); }
    if (!regs.fN) { m.step(0xb75f, 3); continue; }
    m.step(0xb785, 2); break;
  }
  regs.y = 0x04; regs.setNZ(regs.y); m.step(0xb787, 2);
  regs.a = mem.read8(0x0135); regs.setNZ(regs.a); m.step(0xb78a, 4);
  regs.cmp(0x06); m.step(0xb78c, 2);
  if (regs.fNC) {
    m.step(0xb796, 3);
  } else {
    m.step(0xb78e, 2);
    regs.y = 0x0b; regs.setNZ(regs.y); m.step(0xb790, 2);
    regs.cmp(0x08); m.step(0xb792, 2);
    if (regs.fNC) {
      m.step(0xb796, 3);
    } else {
      m.step(0xb794, 2);
      regs.y = 0x0c; regs.setNZ(regs.y); m.step(0xb796, 2);
    }
  }
  mem.write8(0x0808, regs.y); m.step(0xb799, 4);
  return m.ret(6);
}
