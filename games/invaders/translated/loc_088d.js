// SPDX-License-Identifier: GPL-3.0-only
// loc_088d  (ROM 0x088d-0x08ce) -- called from 0x07f9: render 14-entry sprite table via loc_08f3, maybe
// shift one more (cnc loc_08ff on 0x2067 bit0), seat mask 0x20c0=0xb0 and drain it: loc_09ca+loc_1931 (bit2 clear) or strip via loc_14cb (bit2 set) until 0x20c0==0.
export function loc_088d(m) {
  const { regs, mem } = m;

  regs.hl = 0x2b11; m.step(0x0890, 10); // 088d  lxi h,0x2b11
  regs.de = 0x1b70; m.step(0x0893, 10); // 0890  lxi d,0x1b70
  regs.c = 0x0e; m.step(0x0895, 7); // 0893  mvi c,0x0e
  m.push16(0x0898); m.step(0x08f3, 17); m.call(0x08f3); // 0895  call 0x08f3
  regs.a = mem.read8(0x2067); m.step(0x089b, 13); // 0898  lda 0x2067
  regs.rrca(); m.step(0x089c, 4); // 089b  rrc
  regs.a = 0x1c; m.step(0x089e, 7); // 089c  mvi a,0x1c
  regs.hl = 0x3711; m.step(0x08a1, 10); // 089e  lxi h,0x3711
  if (regs.fNC) { m.push16(0x08a4); m.step(0x08ff, 17); m.call(0x08ff); }
  else { m.step(0x08a4, 11); }
  regs.a = 0xb0; m.step(0x08a6, 7); // 08a4  mvi a,0xb0
  mem.write8(0x20c0, regs.a); m.step(0x08a9, 13); // 08a6  sta 0x20c0

  for (;;) { // loc_08a9
    regs.a = mem.read8(0x20c0); m.step(0x08ac, 13); // 08a9  lda 0x20c0
    regs.and(regs.a); m.step(0x08ad, 4); // 08ac  ana a
    if (regs.fZ) { return m.ret(11); }
    m.step(0x08ae, 5);
    regs.and(0x04); m.step(0x08b0, 7); // 08ae  ani 0x04
    if (regs.fNZ) {
      m.step(0x08bc, 10);
      regs.b = 0x20; m.step(0x08be, 7); // 08bc  mvi b,0x20
      regs.hl = 0x271c; m.step(0x08c1, 10); // 08be  lxi h,0x271c
      regs.a = mem.read8(0x2067); m.step(0x08c4, 13); // 08c1  lda 0x2067
      regs.rrca(); m.step(0x08c5, 4); // 08c4  rrc
      if (regs.fC) { m.step(0x08cb, 10); }
      else { m.step(0x08c8, 10); regs.hl = 0x391c; m.step(0x08cb, 10); } // 08c8  lxi h,0x391c
      m.push16(0x08ce); m.step(0x14cb, 17); m.call(0x14cb); // 08cb  call 0x14cb
      m.step(0x08a9, 10);
    } else {
      m.step(0x08b3, 10);
      m.push16(0x08b6); m.step(0x09ca, 17); m.call(0x09ca); // 08b3  call 0x09ca
      m.push16(0x08b9); m.step(0x1931, 17); m.call(0x1931); // 08b6  call 0x1931
      m.step(0x08a9, 10); // 08b9  jmp 0x08a9
    }
  }
}
