// SPDX-License-Identifier: GPL-3.0-only
// loc_08f3  (ROM 0x08f3-0x08fe) -- widely-called sprite-list driver. For C entries starting at DE,
// it loads A from (DE), calls loc_08ff to shift/blit that sprite (DE saved across the call), then
// advances DE and repeats until C decrements to zero.
export function loc_08f3(m) {
  const { regs, mem } = m;

  for (;;) { // loc_08f3
    regs.a = mem.read8(regs.de); m.step(0x08f4, 7); // 08f3  ldax d
    m.push16(regs.de); m.step(0x08f5, 11); // 08f4  push d
    m.push16(0x08f8); m.step(0x08ff, 17); m.call(0x08ff); // 08f5  call 0x08ff
    regs.de = m.pop16(); m.step(0x08f9, 10); // 08f8  pop d
    regs.de = (regs.de + 1) & 0xffff; m.step(0x08fa, 5); // 08f9  inx d
    regs.c = regs.dec8(regs.c); m.step(0x08fb, 5); // 08fa  dcr c
    if (regs.fNZ) { m.step(0x08f3, 10); continue; } // 08fb  jnz 0x08f3
    m.step(0x08fe, 10); // 08fb  jnz (not taken)
    break;
  }
  return m.ret(10); // 08fe  ret
}
