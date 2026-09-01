// SPDX-License-Identifier: GPL-3.0-only
// loc_1671  (ROM 0x1671-0x16c8) -- tail entry `jmp 0x1671` from 0x196e. Compares a pair at 0x20f4/0x20f5
// against the table at HL, conditionally copies the pair, then branches on 0x20ce to loc_16c9 or 0x02ed.
export function loc_1671(m) {
  const { regs, mem } = m;

  m.push16(0x1674); m.step(0x1910, 17); m.call(0x1910); // 1671  call 0x1910
  mem.write8(regs.hl, 0x00); m.step(0x1676, 10); // 1674  mvi m,0x00
  m.push16(0x1679); m.step(0x09ca, 17); m.call(0x09ca); // 1676  call 0x09ca
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x167a, 5);
  regs.de = 0x20f5; m.step(0x167d, 10); // 167a  lxi d,0x20f5
  regs.a = mem.read8(regs.de); m.step(0x167e, 7); // 167d  ldax d
  regs.cp(mem.read8(regs.hl)); m.step(0x167f, 7); // 167e  cmp m
  regs.de = (regs.de - 1) & 0xffff; m.step(0x1680, 5);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x1681, 5);
  regs.a = mem.read8(regs.de); m.step(0x1682, 7);

  let toLoc1698 = false;
  if (regs.fZ) { // 1682  jz 0x168b
    m.step(0x168b, 10);
    regs.cp(mem.read8(regs.hl)); m.step(0x168c, 7); // 168b  cmp m
    if (regs.fNC) { m.step(0x1698, 10); toLoc1698 = true; } // 168c  jnc 0x1698 (taken)
    else { m.step(0x168f, 10); }
  } else {
    m.step(0x1685, 10); // 1682  jz not taken
    if (regs.fNC) { m.step(0x1698, 10); toLoc1698 = true; } // 1685  jnc 0x1698 (taken)
    else { m.step(0x1688, 10); m.step(0x168f, 10); } // 1685 (nt) -> 1688 jmp 0x168f
  }

  if (!toLoc1698) { // loc_168f
    regs.a = mem.read8(regs.hl); m.step(0x1690, 7);
    mem.write8(regs.de, regs.a); m.step(0x1691, 7);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1692, 5);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1693, 5);
    regs.a = mem.read8(regs.hl); m.step(0x1694, 7);
    mem.write8(regs.de, regs.a); m.step(0x1695, 7);
    m.push16(0x1698); m.step(0x1950, 17); m.call(0x1950); // 1695  call 0x1950 -> loc_1698
  }

  regs.a = mem.read8(0x20ce); m.step(0x169b, 13); // 1698  lda 0x20ce
  regs.and(regs.a); m.step(0x169c, 4);
  if (regs.fZ) { m.step(0x16c9, 10); return m.call(0x16c9); } // 169c  jz 0x16c9 (delegate)
  m.step(0x169f, 10); // 169c  jz not taken
  regs.hl = 0x2803; m.step(0x16a2, 10); // 169f  lxi h,0x2803
  regs.de = 0x1aa6; m.step(0x16a5, 10);
  regs.c = 0x14; m.step(0x16a7, 7);
  m.push16(0x16aa); m.step(0x0a93, 17); m.call(0x0a93); // 16a7  call 0x0a93
  regs.h = regs.dec8(regs.h); m.step(0x16ab, 5);
  regs.h = regs.dec8(regs.h); m.step(0x16ac, 5);
  regs.b = 0x1b; m.step(0x16ae, 7);
  regs.a = mem.read8(0x2067); m.step(0x16b1, 13); // 16ae  lda 0x2067
  regs.rrca(); m.step(0x16b2, 4); // 16b1  rrc
  if (regs.fNC) { m.step(0x16b5, 10); regs.b = 0x1c; m.step(0x16b7, 7); } // 16b2 jc (nt) + 16b5 mvi b,0x1c
  else { m.step(0x16b7, 10); }

  regs.a = regs.b; m.step(0x16b8, 5);
  m.push16(0x16bb); m.step(0x08ff, 17); m.call(0x08ff); // 16b8  call 0x08ff
  m.push16(0x16be); m.step(0x0ab1, 17); m.call(0x0ab1); // 16bb  call 0x0ab1
  m.push16(0x16c1); m.step(0x18e7, 17); m.call(0x18e7); // 16be  call 0x18e7
  regs.a = mem.read8(regs.hl); m.step(0x16c2, 7);
  regs.and(regs.a); m.step(0x16c3, 4);
  if (regs.fZ) { m.step(0x16c9, 10); return m.call(0x16c9); } // 16c3  jz 0x16c9 (delegate)
  m.step(0x16c6, 10); // 16c3  jz not taken
  m.step(0x02ed, 10); return m.call(0x02ed); // 16c6  jmp 0x02ed (delegate)
}
