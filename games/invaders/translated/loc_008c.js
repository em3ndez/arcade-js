// SPDX-License-Identifier: GPL-3.0-only
// loc_008c  (ROM 0x008c-0x00b0) -- RST1 (mid-screen) body, tail-jumped from loc_0008: clear
// 0x2072 busy flag, bail to epilogue 0x0082 unless play flag set, else run the 0x024b/0x0141 draw pair.
export function loc_008c(m) {
  const { regs, mem } = m;

  regs.xor(regs.a); m.step(0x008d, 4); // 008c  xra a
  mem.write8(0x2072, regs.a); m.step(0x0090, 13); // 008d  sta 0x2072
  regs.a = mem.read8(0x20e9); m.step(0x0093, 13); // 0090  lda 0x20e9
  regs.and(regs.a); m.step(0x0094, 4); // 0093  ana a
  if (regs.fZ) { m.step(0x0082, 10); return m.call(0x0082); } // 0094  jz 0x0082
  m.step(0x0097, 10);
  regs.a = mem.read8(0x20ef); m.step(0x009a, 13); // 0097  lda 0x20ef
  regs.and(regs.a); m.step(0x009b, 4); // 009a  ana a
  if (regs.fNZ) {
    m.step(0x00a5, 10);
  } else {
    m.step(0x009e, 10); // 009b  jnz not taken
    regs.a = mem.read8(0x20c1); m.step(0x00a1, 13); // 009e  lda 0x20c1
    regs.rrca(); m.step(0x00a2, 4); // 00a1  rrc
    if (regs.fNC) { m.step(0x0082, 10); return m.call(0x0082); } // 00a2  jnc 0x0082
    m.step(0x00a5, 10); // 00a2  jnc not taken -> fall into loc_00a5
  }

  regs.hl = 0x2020; m.step(0x00a8, 10); // 00a5  lxi h,0x2020
  m.push16(0x00ab); m.step(0x024b, 17); m.call(0x024b); // 00a8  call 0x024b
  m.push16(0x00ae); m.step(0x0141, 17); m.call(0x0141); // 00ab  call 0x0141
  m.step(0x0082, 10); return m.call(0x0082); // 00ae  jmp 0x0082
}
