// SPDX-License-Identifier: GPL-3.0-only

// loc_0008  (ROM 0x0008-0x000E)
export function loc_0008(m) {
  const { regs, mem } = m;

  regs.add(regs.l);
  m.step(0x0009, 4); // add a,l
  const carry = regs.fC;
  regs.l = regs.a;
  m.step(0x000a, 4); // ld l,a

  if (!carry) {
    m.step(0x000d, 12); // jr nc,0x000d (taken)
  } else {
    m.step(0x000c, 7); // jr nc (not taken)
    regs.h = regs.inc8(regs.h);
    m.step(0x000d, 4); // inc h -- sets S/Z/H/PV/F3/F5, leaves C
  }

  regs.a = mem.read8(regs.hl);
  m.step(0x000e, 7); // ld a,(hl)
  m.ret(); // 000e  ret
}
