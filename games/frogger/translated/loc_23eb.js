// SPDX-License-Identifier: GPL-3.0-only

// loc_23eb  (ROM 0x23EB-0x23F9) — river-object phase counter: (0x8123) += 1, wrapping to 0 once it
// reaches 0x06 (a mod-6 lane-animation frame index).
export function loc_23eb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8123);
  m.step(0x23ee, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x23ef, 4);
  mem.write8(0x8123, regs.a);
  m.step(0x23f2, 13); // (0x8123) = counter + 1
  regs.cp(0x06);
  m.step(0x23f4, 7);
  if (regs.fC) {
    m.ret(11);
    return;
  } // ret c -- still < 6
  m.step(0x23f5, 5);
  regs.xor(regs.a);
  m.step(0x23f6, 4); // A = 0 -- wrap
  mem.write8(0x8123, regs.a);
  m.step(0x23f9, 13);
  m.ret(10);
}
