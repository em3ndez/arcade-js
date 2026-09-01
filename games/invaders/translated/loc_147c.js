// SPDX-License-Identifier: GPL-3.0-only
// loc_147c  (ROM 0x147c-0x1490) -- block-copy tiles into a rectangle: for B rows, copy C bytes
// from [HL] to [DE] (inner loop 0x147e), then advance the row base HL by 0x20. Both the outer
// head 0x147c and the inner top 0x147e are loop tops; only 0x147c is a head.
export function loc_147c(m) {
  const { regs, mem } = m;

  for (;;) { // 147c  outer row loop
    m.push16(regs.bc); m.step(0x147d, 11); // 147c  push b
    m.push16(regs.hl); m.step(0x147e, 11); // 147d  push h
    for (;;) { // 147e  inner byte copy
      regs.a = mem.read8(regs.hl); m.step(0x147f, 7); // 147e  mov a,m
      mem.write8(regs.de, regs.a); m.step(0x1480, 7); // 147f  stax d
      regs.de = (regs.de + 1) & 0xffff; m.step(0x1481, 5); // 1480  inx d
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1482, 5); // 1481  inx h
      regs.c = regs.dec8(regs.c); m.step(0x1483, 5); // 1482  dcr c
      if (regs.fNZ) { m.step(0x147e, 10); continue; } // 1483  jnz 0x147e
      m.step(0x1486, 10);
      break;
    }
    regs.hl = m.pop16(); m.step(0x1487, 10); // 1486  pop h
    regs.bc = 0x0020; m.step(0x148a, 10); // 1487  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x148b, 10); // 148a  dad b
    regs.bc = m.pop16(); m.step(0x148c, 10); // 148b  pop b
    regs.b = regs.dec8(regs.b); m.step(0x148d, 5); // 148c  dcr b
    if (regs.fNZ) { m.step(0x147c, 10); continue; } // 148d  jnz 0x147c
    m.step(0x1490, 10);
    break;
  }
  return m.ret(10); // 1490  ret
}
