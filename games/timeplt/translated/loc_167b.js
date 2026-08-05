// SPDX-License-Identifier: GPL-3.0-only

// loc_167b  (ROM 0x167B-0x168F)
export function loc_167b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa986);
  m.step(0x167e, 13); // 167b  ld a,(0xa986)
  regs.and(regs.a);
  m.step(0x167f, 4); // 167e  and a

  if (regs.fNZ) {
    m.step(0x0f11, 10); // 167f  jp nz,0x0f11 (taken) -- tail jump
    return m.call(0x0f11);
  }
  m.step(0x1682, 10); // 167f  jp nz,0x0f11 (not taken)

  regs.a = mem.read8(0xa9c0);
  m.step(0x1685, 13); // 1682  ld a,(0xa9c0)
  regs.and(regs.a);
  m.step(0x1686, 4); // 1685  and a

  if (regs.fZ) {
    m.ret(11); // 1686  ret z (taken)
    return;
  }
  m.step(0x1687, 5); // 1686  ret z (not taken)

  regs.a = mem.read8(0xa9ae);
  m.step(0x168a, 13); // 1687  ld a,(0xa9ae)
  regs.and(0x18);
  m.step(0x168c, 7); // 168a  and 0x18 -- bits 4 and 3, the two loc_1690 tests

  if (regs.fZ) {
    m.ret(11); // 168c  ret z (taken)
    return;
  }
  m.step(0x168d, 5); // 168c  ret z (not taken)

  m.push16(0x1690);
  m.step(0x15b6, 17); // 168d  call 0x15b6
  m.call(0x15b6);

  return m.call(0x1690);
}
