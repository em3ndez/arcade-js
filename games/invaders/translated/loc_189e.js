// SPDX-License-Identifier: GPL-3.0-only
// loc_189e  (ROM 0x189e-0x18d3) -- init via loc_1a32 (0x2050<-0x1bc0, B=0x10), seed 0x2080=2 /
// 0x207e=0xff / 0x20c1=4, busy-wait bit0 of 0x2055 (set at loc_18b8 then clear at loc_18c0), draw via loc_08ff (HL=0x3311, A=0x26), tail-jmp loc_0ab6.
export function loc_189e(m) {
  const { regs, mem } = m;

  regs.hl = 0x2050; m.step(0x18a1, 10); // 189e  lxi h,0x2050
  regs.de = 0x1bc0; m.step(0x18a4, 10); // 18a1  lxi d,0x1bc0
  regs.b = 0x10; m.step(0x18a6, 7);
  m.push16(0x18a9); m.step(0x1a32, 17); m.call(0x1a32); // 18a6  call 0x1a32
  regs.a = 0x02; m.step(0x18ab, 7); // 18a9  mvi a,0x02
  mem.write8(0x2080, regs.a); m.step(0x18ae, 13); // 18ab  sta 0x2080
  regs.a = 0xff; m.step(0x18b0, 7); // 18ae  mvi a,0xff
  mem.write8(0x207e, regs.a); m.step(0x18b3, 13); // 18b0  sta 0x207e
  regs.a = 0x04; m.step(0x18b5, 7); // 18b3  mvi a,0x04
  mem.write8(0x20c1, regs.a); m.step(0x18b8, 13); // 18b5  sta 0x20c1

  for (;;) { // loc_18b8  spin until bit0 of 0x2055 set
    regs.a = mem.read8(0x2055); m.step(0x18bb, 13); // 18b8  lda 0x2055
    regs.and(0x01); m.step(0x18bd, 7); // 18bb  ani 0x01
    if (regs.fZ) { m.step(0x18b8, 10); continue; } // 18bd  jz 0x18b8
    m.step(0x18c0, 10);
    break;
  }
  for (;;) { // loc_18c0  spin until bit0 of 0x2055 clear
    regs.a = mem.read8(0x2055); m.step(0x18c3, 13); // 18c0  lda 0x2055
    regs.and(0x01); m.step(0x18c5, 7); // 18c3  ani 0x01
    if (regs.fNZ) { m.step(0x18c0, 10); continue; } // 18c5  jnz 0x18c0
    m.step(0x18c8, 10);
    break;
  }

  regs.hl = 0x3311; m.step(0x18cb, 10); // 18c8  lxi h,0x3311
  regs.a = 0x26; m.step(0x18cd, 7); // 18cb  mvi a,0x26
  m.step(0x18ce, 4);
  m.push16(0x18d1); m.step(0x08ff, 17); m.call(0x08ff); // 18ce  call 0x08ff
  m.step(0x0ab6, 10); return m.call(0x0ab6); // 18d1  jmp 0x0ab6
}
