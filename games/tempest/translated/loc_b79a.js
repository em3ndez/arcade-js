// SPDX-License-Identifier: GPL-3.0-only
// loc_b79a  (ROM 0xb79a-0xb7e4) -- clears $9e, loops X=$37 7..0 over $030a,x (skip if 0): $57=cell,
// $29=$02fa,x, Y=$0302,x. If Y==1 jsr $b7eb; else A=(($0312,x)>>1 & 0xfe) (zeroed if Y>=2) + table $b7e5,y,
// Y=$29, jsr $bcfd. After the loop, if $0720!=0 and $9f>=0x0d, store $9f to $01ff. rts.
export function loc_b79a(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb79c, 2);
  mem.write8(0x9e, regs.y); m.step(0xb79e, 3);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xb7a0, 2);
  mem.write8(0x37, regs.x); m.step(0xb7a2, 3);
  while (true) {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xb7a4, 3);
    { const a = (0x030a + regs.x) & 0xffff;
      regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb7a7, 4 + ((0x030a & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
    if (regs.fZ) {
      m.step(0xb7d2, 3);
    } else {
      m.step(0xb7a9, 2);
      mem.write8(0x57, regs.a); m.step(0xb7ab, 3);
      { const a = (0x02fa + regs.x) & 0xffff;
        regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb7ae, 4 + ((0x02fa & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
      mem.write8(0x29, regs.a); m.step(0xb7b0, 3);
      { const a = (0x0302 + regs.x) & 0xffff;
        regs.y = mem.read8(a); regs.setNZ(regs.y); m.step(0xb7b3, 4 + ((0x0302 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
      regs.cpy(0x01); m.step(0xb7b5, 2);
      if (regs.fNZ) {
        m.step(0xb7bd, 3);
        { const a = (0x0312 + regs.x) & 0xffff;
          regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb7c0, 4 + ((0x0312 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
        regs.a = regs.lsr(regs.a); m.step(0xb7c1, 2);
        regs.and(0xfe); m.step(0xb7c3, 2);
        regs.cpy(0x02); m.step(0xb7c5, 2);
        if (regs.fNC) {
          m.step(0xb7c9, 3);
        } else {
          m.step(0xb7c7, 2);
          regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb7c9, 2);
        }
        regs.clc(); m.step(0xb7ca, 2);
        { const a = (0xb7e5 + regs.y) & 0xffff;
          regs.adc(mem.read8(a)); m.step(0xb7cd, 4 + ((0xb7e5 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
        regs.y = mem.read8(0x29); regs.setNZ(regs.y); m.step(0xb7cf, 3);
        m.push16(0xb7d1); m.step(0xb7d2, 6); m.call(0xbcfd);
      } else {
        m.step(0xb7b7, 2);
        m.push16(0xb7b9); m.step(0xb7ba, 6); m.call(0xb7eb);
        regs.clv(); m.step(0xb7bb, 2);
        m.step(0xb7d2, 3);
      }
    }
    { const dv = (mem.read8(0x37) - 1) & 0xff; mem.write8(0x37, dv); regs.setNZ(dv); m.step(0xb7d4, 5); }
    if (!regs.fN) { m.step(0xb7a2, 3); continue; }
    m.step(0xb7d6, 2); break;
  }
  regs.a = mem.read8(0x0720); regs.setNZ(regs.a); m.step(0xb7d9, 4);
  if (regs.fZ) { m.step(0xb7e4, 3); return m.ret(6); }
  m.step(0xb7db, 2);
  regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0xb7dd, 3);
  regs.cmp(0x0d); m.step(0xb7df, 2);
  if (regs.fNC) { m.step(0xb7e4, 3); return m.ret(6); }
  m.step(0xb7e1, 2);
  mem.write8(0x01ff, regs.a); m.step(0xb7e4, 4);
  return m.ret(6);
}
