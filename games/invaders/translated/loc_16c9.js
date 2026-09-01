// SPDX-License-Identifier: GPL-3.0-only
// loc_16c9  (ROM 0x16c9-0x16e5) -- head, `jmp 0x16c9` from 0x1801 and delegated from loc_1671. Draws the
// 0x2d18 field via 0x0a93, clears 0x20ef + sound port 5, then tail-jumps to loc_0b89.
export function loc_16c9(m) {
  const { regs, mem } = m;

  regs.hl = 0x2d18; m.step(0x16cc, 10); // 16c9  lxi h,0x2d18
  regs.de = 0x1aa6; m.step(0x16cf, 10); // 16cc  lxi d,0x1aa6
  regs.c = 0x0a; m.step(0x16d1, 7); // 16cf  mvi c,0x0a
  m.push16(0x16d4); m.step(0x0a93, 17); m.call(0x0a93); // 16d1  call 0x0a93
  m.push16(0x16d7); m.step(0x0ab6, 17); m.call(0x0ab6); // 16d4  call 0x0ab6
  m.push16(0x16da); m.step(0x09d6, 17); m.call(0x09d6); // 16d7  call 0x09d6
  regs.xor(regs.a); m.step(0x16db, 4); // 16da  xra a
  mem.write8(0x20ef, regs.a); m.step(0x16de, 13); // 16db  sta 0x20ef
  m.io.portOut(0x05, regs.a); m.step(0x16e0, 10); // 16de  out 0x05
  m.push16(0x16e3); m.step(0x19d1, 17); m.call(0x19d1); // 16e0  call 0x19d1
  m.step(0x0b89, 10); return m.call(0x0b89); // 16e3  jmp 0x0b89 (delegate)
}
