// SPDX-License-Identifier: GPL-3.0-only
// loc_15c5  (ROM 0x15c5-0x15d1) -- scan 0x17 (23) bytes from HL for the first nonzero. On a hit,
// tail-branch to 0x166b (which sets carry = "found"); if all 23 are zero, fall through to ret with
// carry clear (the trailing ana a). loc_15c7 is the interior loop top (jnz 0x15c7).
export function loc_15c5(m) {
  const { regs, mem } = m;

  regs.b = 0x17; m.step(0x15c7, 7); // 15c5  mvi b,0x17

  for (;;) { // loc_15c7
    regs.a = mem.read8(regs.hl); m.step(0x15c8, 7); // 15c7  mov a,m
    regs.and(regs.a); m.step(0x15c9, 4); // 15c8  ana a
    if (regs.fNZ) { m.step(0x166b, 10); return m.call(0x166b); } // 15c9  jnz 0x166b
    m.step(0x15cc, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x15cd, 5); // 15cc  inx h
    regs.b = regs.dec8(regs.b); m.step(0x15ce, 5); // 15cd  dcr b
    if (regs.fNZ) { m.step(0x15c7, 10); continue; } // 15ce  jnz 0x15c7
    m.step(0x15d1, 10); break;
  }
  return m.ret(10); // 15d1  ret
}
