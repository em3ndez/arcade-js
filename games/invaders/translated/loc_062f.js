// SPDX-License-Identifier: GPL-3.0-only
// loc_062f (ROM 0x062f-0x0643) -- CALLed from 0x05a5. Scans 5 object slots (stride 0x0b) from
// base (mem[0x2067]<<8 | (c-1)); returns CARRY-SET on first non-empty slot, else rets.
export function loc_062f(m) {
  const { regs, mem } = m;

  regs.c = regs.dec8(regs.c); m.step(0x0630, 5);        // 062f  dcr c
  regs.a = mem.read8(0x2067); m.step(0x0633, 13);       // 0630  lda 0x2067
  regs.h = regs.a; m.step(0x0634, 5);                   // 0633  mov h,a
  regs.l = regs.c; m.step(0x0635, 5);                   // 0634  mov l,c
  regs.d = 0x05; m.step(0x0637, 7);                     // 0635  mvi d,0x05
  for (;;) {                                            // loc_0637
    regs.a = mem.read8(regs.hl); m.step(0x0638, 7);     // 0637  mov a,m
    regs.and(regs.a); m.step(0x0639, 4);                // 0638  ana a
    regs.scf(); m.step(0x063a, 4);                      // 0639  stc
    if (regs.fNZ) { return m.ret(11); }                 // 063a  rnz (taken)
    m.step(0x063b, 5);
    regs.a = regs.l; m.step(0x063c, 5);                 // 063b  mov a,l
    regs.add(0x0b); m.step(0x063e, 7);                  // 063c  adi 0x0b
    regs.l = regs.a; m.step(0x063f, 5);                 // 063e  mov l,a
    regs.d = regs.dec8(regs.d); m.step(0x0640, 5);      // 063f  dcr d
    if (regs.fNZ) { m.step(0x0637, 10); continue; }     // 0640  jnz 0x0637 (taken)
    m.step(0x0643, 10);
    break;
  }
  return m.ret(10);
}
