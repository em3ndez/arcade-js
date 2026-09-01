// SPDX-License-Identifier: GPL-3.0-only
// loc_074b  (ROM 0x074b-0x075e) -- reached by `jz 0x074b` from loc_0682 when the countdown cell
// hit 0x1f. ORs bit4 into the flags byte at 0x2098, calls 0x1770, resets the sprite pointer at
// 0x2087 to table 0x1d7c, then tail-jumps into loc_073c.
export function loc_074b(m) {
  const { regs, mem } = m;
  regs.b = 0x10; m.step(0x074d, 7);                     // 074b mvi b,0x10
  regs.hl = 0x2098; m.step(0x0750, 10);                 // 074d lxi h,0x2098
  regs.a = mem.read8(regs.hl); m.step(0x0751, 7);       // 0750 mov a,m
  regs.or(regs.b); m.step(0x0752, 4);                   // 0751 ora b
  mem.write8(regs.hl, regs.a); m.step(0x0753, 7);       // 0752 mov m,a
  m.push16(0x0756); m.step(0x1770, 17); m.call(0x1770); // 0753 call 0x1770
  regs.hl = 0x1d7c; m.step(0x0759, 10);                 // 0756 lxi h,0x1d7c
  mem.write16(0x2087, regs.hl); m.step(0x075c, 16);     // 0759 shld 0x2087
  m.step(0x073c, 10); return m.call(0x073c);            // 075c jmp 0x073c
}
