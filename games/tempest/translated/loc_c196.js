// SPDX-License-Identifier: GPL-3.0-only
// loc_c196  (ROM 0xc196-0xc1c2) -- clamps ($9f&0x70) to <=0x5f, forms index X=(v>>1)|7, then for
// Y=7..0 splits table byte $c1fd,x nibbles into $0019/$0800 (low) and $0021/$0808 (high).
export function loc_c196(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0xc198, 3);
  regs.and(0x70); m.step(0xc19a, 2);
  regs.cmp(0x5f); m.step(0xc19c, 2);
  // c19c bcc 0xc1a0
  if (regs.fNC) {
    m.step(0xc1a0, 3);
  } else {
    m.step(0xc19e, 2);
    regs.a = 0x5f; regs.setNZ(regs.a); m.step(0xc1a0, 2);
  }
  regs.a = regs.lsr(regs.a); m.step(0xc1a1, 2);
  regs.ora(0x07); m.step(0xc1a3, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xc1a4, 2);
  regs.y = 0x07; regs.setNZ(regs.y); m.step(0xc1a6, 2);
  // c1a6..c1c0 loop (Y=7..0, X descending)
  while (true) {
    { const a = (0xc1fd + regs.x) & 0xffff;
      regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xc1a9, 4 + ((0xc1fd & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
    regs.and(0x0f); m.step(0xc1ab, 2);
    mem.write8((0x0019 + regs.y) & 0xffff, regs.a); m.step(0xc1ae, 5);
    mem.write8((0x0800 + regs.y) & 0xffff, regs.a); m.step(0xc1b1, 5);
    { const a = (0xc1fd + regs.x) & 0xffff;
      regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xc1b4, 4 + ((0xc1fd & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
    regs.a = regs.lsr(regs.a); m.step(0xc1b5, 2);
    regs.a = regs.lsr(regs.a); m.step(0xc1b6, 2);
    regs.a = regs.lsr(regs.a); m.step(0xc1b7, 2);
    regs.a = regs.lsr(regs.a); m.step(0xc1b8, 2);
    mem.write8((0x0021 + regs.y) & 0xffff, regs.a); m.step(0xc1bb, 5);
    mem.write8((0x0808 + regs.y) & 0xffff, regs.a); m.step(0xc1be, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xc1bf, 2);
    regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0xc1c0, 2);
    if (regs.fPl) { m.step(0xc1a6, 3); continue; }
    m.step(0xc1c2, 2); break;
  }
  return m.ret(6);
}
