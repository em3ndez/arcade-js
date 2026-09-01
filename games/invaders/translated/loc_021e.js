// SPDX-License-Identifier: GPL-3.0-only
// loc_021e  (ROM 0x021e-0x0247) -- shared draw body from loc_0214 (DE=0x2242) / loc_021b (DE=0x2142),
// flag A at 0x2081. 4-pass loop: flag==0 -> call 0x1a69 else 0x147c; dec counter, ret at 0, else HL+=0x02e0.
export function loc_021e(m) {
  const { regs, mem } = m;

  mem.write8(0x2081, regs.a); m.step(0x0221, 13); // 021e  sta 0x2081
  regs.bc = 0x1602; m.step(0x0224, 10); // 0221  lxi b,0x1602
  regs.hl = 0x2806; m.step(0x0227, 10); // 0224  lxi h,0x2806
  regs.a = 0x04; m.step(0x0229, 7); // 0227  mvi a,0x04
  for (;;) { // loc_0229
    m.push16(regs.af); m.step(0x022a, 11); // 0229  push psw
    m.push16(regs.bc); m.step(0x022b, 11); // 022a  push b
    regs.a = mem.read8(0x2081); m.step(0x022e, 13); // 022b  lda 0x2081
    regs.and(regs.a); m.step(0x022f, 4); // 022e  ana a
    if (regs.fNZ) {
      m.step(0x0242, 10);
      m.push16(0x0245); m.step(0x147c, 17); m.call(0x147c); // 0242  call 0x147c
      m.step(0x0235, 10);
    } else {
      m.step(0x0232, 10);
      m.push16(0x0235); m.step(0x1a69, 17); m.call(0x1a69); // 0232  call 0x1a69
    }
    regs.bc = m.pop16(); m.step(0x0236, 10); // 0235  pop b
    regs.af = m.pop16(); m.step(0x0237, 10); // 0236  pop psw
    regs.a = regs.dec8(regs.a); m.step(0x0238, 5); // 0237  dcr a
    if (regs.fZ) { return m.ret(11); }
    m.step(0x0239, 5);
    m.push16(regs.de); m.step(0x023a, 11); // 0239  push d
    regs.de = 0x02e0; m.step(0x023d, 10); // 023a  lxi d,0x02e0
    regs.addHl(regs.de); m.step(0x023e, 10); // 023d  dad d
    regs.de = m.pop16(); m.step(0x023f, 10); // 023e  pop d
    m.step(0x0229, 10); continue; // 023f  jmp 0x0229
  }
}
