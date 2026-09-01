// SPDX-License-Identifier: GPL-3.0-only
// loc_15f3  (ROM 0x15f3-0x1610) -- point HL at page [0x2067] via 0x1611, count non-zero cells across
// 0x37 bytes into C, store the count at 0x2082, and write 0x01 to 0x206b only when the count is exactly 1.
export function loc_15f3(m) {
  const { regs, mem } = m;

  m.push16(0x15f6); m.step(0x1611, 17); m.call(0x1611); // 15f3  call 0x1611
  regs.bc = 0x3700; m.step(0x15f9, 10); // 15f6  lxi b,0x3700

  for (;;) { // loc_15f9
    regs.a = mem.read8(regs.hl); m.step(0x15fa, 7); // 15f9  mov a,m
    regs.and(regs.a); m.step(0x15fb, 4); // 15fa  ana a
    if (regs.fZ) {
      m.step(0x15ff, 10); // 15fb  jz 0x15ff (cell is zero)
    } else {
      m.step(0x15fe, 10);
      regs.c = regs.inc8(regs.c); m.step(0x15ff, 5); // 15fe  inr c
    }
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1600, 5); // 15ff  inx h
    regs.b = regs.dec8(regs.b); m.step(0x1601, 5); // 1600  dcr b
    if (regs.fNZ) { m.step(0x15f9, 10); continue; } // 1601  jnz 0x15f9
    m.step(0x1604, 10); break;
  }

  regs.a = regs.c; m.step(0x1605, 5); // 1604  mov a,c
  mem.write8(0x2082, regs.a); m.step(0x1608, 13); // 1605  sta 0x2082
  regs.cp(0x01); m.step(0x160a, 7); // 1608  cpi 0x01
  if (regs.fNZ) { return m.ret(11); } // 160a  rnz (count != 1)
  m.step(0x160b, 5);
  regs.hl = 0x206b; m.step(0x160e, 10); // 160b  lxi h,0x206b
  mem.write8(regs.hl, 0x01); m.step(0x1610, 10); // 160e  mvi m,0x01
  return m.ret(10); // 1610  ret
}
