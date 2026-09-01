// SPDX-License-Identifier: GPL-3.0-only
// loc_1775  (ROM 0x1775-0x17b3) -- if the 0x2095 trigger is set, pick a port-5 sound byte from the tables
// at 0x1a11/0x1a21 into mem[0x2098], clear the trigger; then tick the 0x2099 timer, else seed B=0xef and tail-jump to 0x19dc.
export function loc_1775(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2095); m.step(0x1778, 13); // 1775  lda 0x2095
  regs.and(regs.a); m.step(0x1779, 4); // 1778  ana a
  if (regs.fNZ) {
    m.step(0x177c, 10);
    regs.hl = 0x1a11; m.step(0x177f, 10);
    regs.de = 0x1a21; m.step(0x1782, 10);
    regs.a = mem.read8(0x2082); m.step(0x1785, 13); // 1782  lda 0x2082

    for (;;) { // loc_1785
      regs.cp(mem.read8(regs.hl)); m.step(0x1786, 7); // 1785  cmp m
      if (regs.fNC) { m.step(0x178e, 10); break; }
      m.step(0x1789, 10);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x178a, 5); // 1789  inx h
      regs.de = (regs.de + 1) & 0xffff; m.step(0x178b, 5); // 178a  inx d
      m.step(0x1785, 10);
    }

    regs.a = mem.read8(regs.de); m.step(0x178f, 7); // 178e  ldax d
    mem.write8(0x2097, regs.a); m.step(0x1792, 13); // 178f  sta 0x2097
    regs.hl = 0x2098; m.step(0x1795, 10); // 1792  lxi h,0x2098
    regs.a = mem.read8(regs.hl); m.step(0x1796, 7); // 1795  mov a,m
    regs.and(0x30); m.step(0x1798, 7); // 1796  ani 0x30
    regs.b = regs.a; m.step(0x1799, 5); // 1798  mov b,a
    regs.a = mem.read8(regs.hl); m.step(0x179a, 7); // 1799  mov a,m
    regs.and(0x0f); m.step(0x179c, 7); // 179a  ani 0x0f
    regs.rlca(); m.step(0x179d, 4); // 179c  rlc
    regs.cp(0x10); m.step(0x179f, 7); // 179d  cpi 0x10
    if (regs.fNZ) { m.step(0x17a4, 10); }
    else { m.step(0x17a2, 10); regs.a = 0x01; m.step(0x17a4, 7); } // 17a2  mvi a,0x01
    regs.or(regs.b); m.step(0x17a5, 4); // 17a4  ora b
    mem.write8(regs.hl, regs.a); m.step(0x17a6, 7); // 17a5  mov m,a
    regs.xor(regs.a); m.step(0x17a7, 4); // 17a6  xra a
    mem.write8(0x2095, regs.a); m.step(0x17aa, 13); // 17a7  sta 0x2095
  } else {
    m.step(0x17aa, 10);
  }

  regs.hl = 0x2099; m.step(0x17ad, 10); // 17aa  lxi h,0x2099
  regs.decMem8(mem, regs.hl); m.step(0x17ae, 10); // 17ad  dcr m
  if (regs.fNZ) { return m.ret(11); }
  m.step(0x17af, 5);
  regs.b = 0xef; m.step(0x17b1, 7); // 17af  mvi b,0xef
  m.step(0x19dc, 10); return m.call(0x19dc);
}
