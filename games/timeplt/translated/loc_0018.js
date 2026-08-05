// SPDX-License-Identifier: GPL-3.0-only

// loc_0018  (ROM 0x0018-0x001C)
export function loc_0018(m) {
  const { regs } = m;

  regs.add(regs.l);
  m.step(0x0019, 4); // add a,l
  const carry = regs.fC;
  regs.l = regs.a;
  m.step(0x001a, 4); // ld l,a

  if (!carry) {
    m.ret(11); // 001a  ret nc (taken)
    return;
  }
  m.step(0x001b, 5); // ret nc (not taken)
  regs.h = regs.inc8(regs.h);
  m.step(0x001c, 4); // inc h -- sets S/Z/H/PV/F3/F5, leaves C
  m.ret(); // 001c  ret
}
