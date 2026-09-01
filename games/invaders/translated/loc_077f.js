// SPDX-License-Identifier: GPL-3.0-only
// loc_077f  (ROM 0x077f-0x0797) -- reached by `jmp 0x077f` at 0x086a and fallen into from
// loc_0765. If (mem[0x20eb]-1)!=0 it tail-jumps to loc_0857; otherwise it draws and polls
// IN1 bit2, looping until the bit sets, then falls through into loc_0798.
export function loc_077f(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.a = mem.read8(0x20eb); m.step(0x0782, 13);              // 077f  lda 0x20eb
    regs.a = regs.dec8(regs.a); m.step(0x0783, 5);              // 0782  dcr a
    regs.hl = 0x2810; m.step(0x0786, 10);                       // 0783  lxi h,0x2810
    regs.c = 0x14; m.step(0x0788, 7);                            // 0786  mvi c,0x14
    if (regs.fNZ) { m.step(0x0857, 10); return m.call(0x0857); } // 0788  jnz 0x0857
    m.step(0x078b, 10);                                          // 0788  (not taken)
    regs.de = 0x1acf; m.step(0x078e, 10);                       // 078b  lxi d,0x1acf
    m.push16(0x0791); m.step(0x08f3, 17); m.call(0x08f3);       // 078e  call 0x08f3
    regs.a = m.io.portIn(0x01); m.step(0x0793, 10);             // 0791  in 0x01
    regs.and(0x04); m.step(0x0795, 7);                          // 0793  ani 0x04
    if (regs.fZ) { m.step(0x077f, 10); continue; }              // 0795  jz 0x077f
    m.step(0x0798, 10); return m.call(0x0798);                  // 0798  fall into loc_0798
  }
}
