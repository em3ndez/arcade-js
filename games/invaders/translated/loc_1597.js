// SPDX-License-Identifier: GPL-3.0-only
// loc_1597  (ROM 0x1597-0x15c4) -- scan region 0x3ea4 or 0x2524 (per the 0x200d flag) via 0x15c5; on
// "clear" (carry clear) bail via rnc, else commit new state through the shared loc_15a9 tail. loc_15a9/loc_15b7 interior.
export function loc_1597(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x200d); m.step(0x159a, 13); // 1597  lda 0x200d
  regs.and(regs.a); m.step(0x159b, 4); // 159a  ana a
  if (regs.fNZ) {
    m.step(0x15b7, 10);
    // loc_15b7
    regs.hl = 0x2524; m.step(0x15ba, 10); // 15b7  lxi h,0x2524
    m.push16(0x15bd); m.step(0x15c5, 17); m.call(0x15c5); // 15ba  call 0x15c5
    if (regs.fNC) { return m.ret(11); }
    m.step(0x15be, 5);
    m.push16(0x15c1); m.step(0x18f1, 17); m.call(0x18f1); // 15be  call 0x18f1
    regs.xor(regs.a); m.step(0x15c2, 4); // 15c1  xra a
    m.step(0x15a9, 10);
  } else {
    m.step(0x159e, 10);
    regs.hl = 0x3ea4; m.step(0x15a1, 10); // 159e  lxi h,0x3ea4
    m.push16(0x15a4); m.step(0x15c5, 17); m.call(0x15c5); // 15a1  call 0x15c5
    if (regs.fNC) { return m.ret(11); }
    m.step(0x15a5, 5);
    regs.b = 0xfe; m.step(0x15a7, 7); // 15a5  mvi b,0xfe
    regs.a = 0x01; m.step(0x15a9, 7); // 15a7  mvi a,0x01
  }

  // loc_15a9: shared commit tail (fall-through from the else arm, or jmp 0x15a9 from the if arm)
  mem.write8(0x200d, regs.a); m.step(0x15ac, 13); // 15a9  sta 0x200d
  regs.a = regs.b; m.step(0x15ad, 5); // 15ac  mov a,b
  mem.write8(0x2008, regs.a); m.step(0x15b0, 13); // 15ad  sta 0x2008
  regs.a = mem.read8(0x200e); m.step(0x15b3, 13); // 15b0  lda 0x200e
  mem.write8(0x2007, regs.a); m.step(0x15b6, 13); // 15b3  sta 0x2007
  return m.ret(10); // 15b6  ret
}
