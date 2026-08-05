// SPDX-License-Identifier: GPL-3.0-only

// loc_0028  (ROM 0x0028-0x002E)
export function loc_0028(m) {
  const { regs } = m;

  regs.a = regs.e;
  m.step(0x0029, 4); // ld a,e
  regs.add(0x20);
  const carry = regs.fC;
  m.step(0x002b, 7); // add a,0x20
  regs.e = regs.a;
  m.step(0x002c, 4); // ld e,a

  if (!carry) {
    m.ret(11); // 002c  ret nc (taken)
    return;
  }
  m.step(0x002d, 5); // ret nc (not taken)
  regs.d = regs.inc8(regs.d);
  m.step(0x002e, 4); // inc d -- sets flags
  m.ret(); // 002e  ret
}
