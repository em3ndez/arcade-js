// SPDX-License-Identifier: GPL-3.0-only
// loc_16e6  (ROM 0x16e6-0x170d + interior loop loc_16ee) -- head, `jmp 0x16e6` from 0x1976. Reseats SP,
// enables interrupts, clears 0x2015, spins the 0x14d8/0x0a59 wait loop, then tail-jumps to loc_196b.
export function loc_16e6(m) {
  const { regs, mem } = m;

  regs.sp = 0x2400; m.step(0x16e9, 10); // 16e6  lxi sp,0x2400
  m.io.setInte(true); m.step(0x16ea, 4); // 16e9  ei
  regs.xor(regs.a); m.step(0x16eb, 4); // 16ea  xra a
  mem.write8(0x2015, regs.a); m.step(0x16ee, 13); // 16eb  sta 0x2015

  for (;;) { // loc_16ee
    m.push16(0x16f1); m.step(0x14d8, 17); m.call(0x14d8); // 16ee  call 0x14d8
    regs.b = 0x04; m.step(0x16f3, 7); // 16f1  mvi b,0x04
    m.push16(0x16f6); m.step(0x18fa, 17); m.call(0x18fa); // 16f3  call 0x18fa
    m.push16(0x16f9); m.step(0x0a59, 17); m.call(0x0a59); // 16f6  call 0x0a59
    if (regs.fNZ) { m.step(0x16ee, 10); continue; } // 16f9  jnz 0x16ee
    m.step(0x16fc, 10); break; // 16f9  jnz not taken
  }

  m.push16(0x16ff); m.step(0x19d7, 17); m.call(0x19d7); // 16fc  call 0x19d7
  regs.hl = 0x2701; m.step(0x1702, 10); // 16ff  lxi h,0x2701
  m.push16(0x1705); m.step(0x19fa, 17); m.call(0x19fa); // 1702  call 0x19fa
  regs.xor(regs.a); m.step(0x1706, 4);
  m.push16(0x1709); m.step(0x1a8b, 17); m.call(0x1a8b); // 1706  call 0x1a8b
  regs.b = 0xfb; m.step(0x170b, 7); // 1709  mvi b,0xfb
  m.step(0x196b, 10); return m.call(0x196b); // 170b  jmp 0x196b (delegate)
}
