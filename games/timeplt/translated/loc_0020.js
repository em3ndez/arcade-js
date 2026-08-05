// SPDX-License-Identifier: GPL-3.0-only

// loc_0020  (ROM 0x0020-0x0026)
export function loc_0020(m) {
  const { regs } = m;

  regs.a = regs.e;
  m.step(0x0021, 4); // ld a,e
  regs.sub(0x20);
  const borrow = regs.fC;
  m.step(0x0023, 7); // sub 0x20
  regs.e = regs.a;
  m.step(0x0024, 4); // ld e,a

  if (!borrow) {
    m.ret(11); // 0024  ret nc (taken)
    return;
  }
  m.step(0x0025, 5); // ret nc (not taken)
  regs.d = regs.dec8(regs.d);
  m.step(0x0026, 4); // dec d -- sets flags
  m.ret(); // 0026  ret
}
