// SPDX-License-Identifier: GPL-3.0-only
// loc_170e  (ROM 0x170e-0x172b) -- call 0x09ca, read mem[HL+1] as a key, then scan the 4-entry threshold
// table at 0x1cb8 (parallel table 0x1aa1) for the first entry >= key, storing its 0x1aa1-side byte to 0x20cf.
export function loc_170e(m) {
  const { regs, mem } = m;

  m.push16(0x1711); m.step(0x09ca, 17); m.call(0x09ca); // 170e  call 0x09ca
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1712, 5); // 1711  inx h
  regs.a = mem.read8(regs.hl); m.step(0x1713, 7); // 1712  mov a,m
  regs.de = 0x1cb8; m.step(0x1716, 10); // 1713  lxi d,0x1cb8
  regs.hl = 0x1aa1; m.step(0x1719, 10); // 1716  lxi h,0x1aa1
  regs.c = 0x04; m.step(0x171b, 7); // 1719  mvi c,0x04
  regs.b = regs.a; m.step(0x171c, 5); // 171b  mov b,a

  for (;;) { // loc_171c
    regs.a = mem.read8(regs.de); m.step(0x171d, 7); // 171c  ldax d
    regs.cp(regs.b); m.step(0x171e, 4); // 171d  cmp b
    if (regs.fNC) { m.step(0x1727, 10); break; }
    m.step(0x1721, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1722, 5); // 1721  inx h
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1723, 5); // 1722  inx d
    regs.c = regs.dec8(regs.c); m.step(0x1724, 5); // 1723  dcr c
    if (regs.fNZ) { m.step(0x171c, 10); continue; }
    m.step(0x1727, 10); break;
  }

  regs.a = mem.read8(regs.hl); m.step(0x1728, 7); // 1727  mov a,m
  mem.write8(0x20cf, regs.a); m.step(0x172b, 13); // 1728  sta 0x20cf
  return m.ret(10); // 172b  ret
}
